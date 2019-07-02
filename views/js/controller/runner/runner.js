/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2016-2017 (original work) Open Assessment Technologies SA ;
 */

/**
 * Test runner controller entry
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'jquery',
    'lodash',
    'i18n',
    'context',
    'module',
    'core/router',
    'core/logger',
    'layout/loading-bar',
    'ui/feedback',
    'util/url',
    'taoTests/runner/providerLoader',
    'taoTests/runner/runner',
    'css!taoQtiTestCss/new-test-runner'
], function (
    $,
    _,
    __,
    context,
    module,
    router,
    loggerFactory,
    loadingBar,
    feedback,
    urlUtil,
    providerLoader,
    runner
) {
    'use strict';

    /**
     * List of options required by the controller
     * @type {String[]}
     */
    const requiredOptions = [
        'testDefinition',
        'testCompilation',
        'serviceCallId',
        'bootstrap',
        'options',
        'providers'
    ];

    /**
     * The runner controller
     */
    return {

        /**
         * Controller entry point
         *
         * @param {Object}   options - the testRunner options
         * @param {String}   options.testDefinition - the test definition id
         * @param {String}   options.testCompilation - the test compilation id
         * @param {String}   options.serviceCallId - the service call id
         * @param {Object}   options.bootstrap - contains the extension and the controller to call
         * @param {String}   options.exitUrl - the full URL where to return at the final end of the test
         * @param {Object[]} options.plugins - the collection of plugins to load
         * @param {Object[]} options.providers - the collection of providers to load
         */
        start(options) {
            let exitReason;
            const $container = $('.runner');
            const logger = loggerFactory('controller/runner', {
                serviceCallId : options.serviceCallId,
                plugins : Object.keys(options.providers.plugins)
            });
            let preventFeedback = false;
            let errorFeedback = null;

            /**
             * Does the option exists ?
             * @param {String} name - the option key
             * @returns {Boolean}
             */
            const hasOption = function hasOption(name){
                return typeof options[name] !== 'undefined';
            };

            /**
             * Exit the test runner using the configured exitUrl
             * @param {String} [reason] - to add a warning once left
             * @param {String} [level] - error level
             */
            const exit = function exit(reason, level){
                let url = options.options.exitUrl;
                const params = {};
                if (reason) {
                    if (!level) {
                        level = 'warning';
                    }
                    params[level] = reason;
                    url = urlUtil.build(url, params);
                }
                window.location = url;
            };

            /**
             * Handles errors
             * @param {Error} err - the thrown error
             * @param {String} [displayMessage] - an alternate message to display
             */
            const onError = function onError(err, displayMessage) {
                onFeedback(err, displayMessage, "error");
            };

            /**
             * Handles warnings
             * @param {Error} err - the thrown error
             * @param {String} [displayMessage] - an alternate message to display
             */
            const onWarning = function onWarning(err, displayMessage) {
                onFeedback(err, displayMessage, "warning");
            };

            /**
             * Handles errors & warnings
             * @param {String} [displayMessage] - an alternate message to display
             * @param {String} [type] - "error" or "warning"
             */
            const onFeedback = function onFeedback(err, displayMessage, type) {
                const typeMap = {
                    warning: {
                        logger: "warn",
                        feedback: "warning"
                    },
                    error: {
                        logger: "error",
                        feedback: "error"
                    }
                };
                const loggerByType = logger[typeMap[type].logger];
                const feedbackByType = feedback()[typeMap[type].feedback];

                displayMessage = displayMessage || err.message;

                if(!_.isString(displayMessage)){
                    displayMessage = JSON.stringify(displayMessage);
                }
                loadingBar.stop();

                loggerByType({ displayMessage : displayMessage }, err);

                if(type === "error" && (err.code === 403 || err.code === 500)) {
                    displayMessage = `${__('An error occurred during the test, please content your administrator.')} ${displayMessage}`;
                    return exit(displayMessage, 'error');
                }
                if (!preventFeedback) {
                    errorFeedback = feedbackByType(displayMessage, {timeout: -1});
                }
            };

            const moduleConfig = module.config();

            loadingBar.start();

            // verify required options
            if( ! _.every(requiredOptions, hasOption)) {
                return onError(new TypeError(__('Missing required option %s', name)));
            }

            // dispatch any extra registered routes
            if (moduleConfig && _.isArray(moduleConfig.extraRoutes) && moduleConfig.extraRoutes.length) {
                router.dispatch(moduleConfig.extraRoutes);
            }

            //for the qti provider to be selected here
            options.provider = Object.assign( options.provider || {}, { runner: 'qti' });

            //load the plugins and the proxy provider
            providerLoader(options.providers, context.bundle)
                .then(function (results) {

                    const testRunnerConfig = _.omit(options, ['providers']);
                    testRunnerConfig.renderTo = $container;

                    if (results.proxy && typeof results.proxy.getAvailableProviders === 'function') {
                        const loadedProxies = results.proxy.getAvailableProviders();
                        testRunnerConfig.provider.proxy = loadedProxies[0];
                    }

                    logger.debug({
                        config: testRunnerConfig,
                        providers : options.providers
                    }, 'Start test runner');

                    //instantiate the QtiTestRunner
                    runner('qti', results.plugins, testRunnerConfig)
                        .on('error', onError)
                        .on('warning', onWarning)
                        .on('ready', function () {
                            _.defer(function () {
                                $container.removeClass('hidden');
                            });
                        })
                        .on('pause', function(data) {
                            if (data && data.reason) {
                                exitReason = data.reason;
                            }
                        })
                        .after('destroy', function () {
                            this.removeAllListeners();

                            // at the end, we are redirected to the exit URL
                            exit(exitReason);
                        })

                        //FIXME this event should not be triggered on the test runner
                        .on('disablefeedbackalerts', function() {
                            if (errorFeedback) {
                                errorFeedback.close();
                            }
                            preventFeedback = true;
                        })

                        //FIXME this event should not be triggered on the test runner
                        .on('enablefeedbackalerts', function() {
                            preventFeedback = false;
                        })
                        .init();
                })
                .catch(function(err){
                    onError(err, __('An error occurred during the test initialization!'));
                });
        }
    };
});
