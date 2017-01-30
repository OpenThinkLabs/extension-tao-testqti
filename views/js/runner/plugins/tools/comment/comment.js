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
 * Copyright (c) 2016 (original work) Open Assessment Technologies SA ;
 */

/**
 * Test Runner Tool Plugin : Comment form
 *
 * @author Jean-Sébastien Conan <jean-sebastien.conan@vesperiagroup.com>
 */
define([
    'jquery',
    'i18n',
    'taoTests/runner/plugin',
    'ui/hider',
    'util/shortcut',
    'util/namespace',
    'tpl!taoQtiTest/runner/plugins/templates/button',
    'tpl!taoQtiTest/runner/plugins/tools/comment/comment'
], function ($, __, pluginFactory, hider, shortcut, namespaceHelper, buttonTpl, commentTpl) {
    'use strict';

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: 'comment',

        /**
         * Initialize the plugin (called during runner's init)
         */
        init: function init() {
            var self = this;

            var testRunner = this.getTestRunner();
            var testData = testRunner.getTestData() || {};
            var testConfig = testData.config || {};
            var pluginShortcuts = (testConfig.shortcuts || {})[this.getName()] || {};

            /**
             * Checks if the plugin is currently available
             * @returns {Boolean}
             */
            function isEnabled() {
                var context = testRunner.getTestContext();
                return !!context.options.allowComment;
            }

            /**
             * Can we comment ? if not, then we hide the plugin
             */
            function togglePlugin() {
                if (isEnabled()) {
                    self.show();
                } else {
                    self.hide();
                }
            }

            /**
             * Show/hide the comment panel
             */
            function toggleComment() {
                if (self.getState('enabled') !== false) {
                    //just show/hide the form
                    hider.toggle(self.$form);
                    if (!hider.isHidden(self.$form)) {
                        //reset the form on each display
                        self.$input.val('').focus();
                    }
                }
            }

            //build element (detached)
            this.$button = $(buttonTpl({
                control: 'comment',
                title: __('Leave a comment'),
                icon: 'tag',
                text: __('Comment')
            }));

            // register the element in the area broker
            this.getAreaBroker().addNavigationElement(this.getName(), this.$button);

            //get access to controls
            this.$form = $(commentTpl()).appendTo(this.$button);
            this.$input = this.$button.find('[data-control="qti-comment-text"]');
            this.$cancel = this.$button.find('[data-control="qti-comment-cancel"]');
            this.$submit = this.$button.find('[data-control="qti-comment-send"]');

            //attach behavior
            this.$button.on('click', function (e) {
                //prevent action if the click is made inside the form which is a sub part of the button
                if ($(e.target).closest('[data-control="qti-comment"]').length) {
                    return;
                }

                e.preventDefault();
                testRunner.trigger('tool-comment');
            });

            //hide the form without submit
            this.$cancel.on('click', function () {
                hider.hide(self.$form);
            });

            //submit the comment, then hide the form
            this.$submit.on('click', function () {
                var comment = self.$input.val();

                if (comment) {
                    self.disable();

                    testRunner.getProxy()
                        .callTestAction('comment', {
                            comment: comment
                        })
                        .then(function () {
                            hider.hide(self.$form);
                            self.enable();
                        })
                        .catch(function () {
                            hider.hide(self.$form);
                            self.enable();
                        });
                }
            });

            if (testConfig.allowShortcuts) {
                if (pluginShortcuts.toggle) {
                    shortcut.add(namespaceHelper.namespaceAll(pluginShortcuts.toggle, this.getName(), true), function () {
                        testRunner.trigger('tool-comment');
                    }, {
                        avoidInput: true
                    });
                }
            }

            //start disabled
            togglePlugin();
            this.disable();

            //update plugin state based on changes
            testRunner
                .on('loaditem', togglePlugin)
                .on('renderitem', function () {
                    self.enable();
                })
                .on('unloaditem', function () {
                    self.disable();
                })
                .on('tool-comment', function () {
                    if (isEnabled()) {
                        toggleComment();
                    }
                });
        },

        /**
         * Called during the runner's destroy phase
         */
        destroy: function destroy() {
            shortcut.remove('.' + this.getName());
            this.$button.remove();
        },

        /**
         * Enable the button
         */
        enable: function enable() {
            this.$button.removeProp('disabled')
                .removeClass('disabled');
        },

        /**
         * Disable the button
         */
        disable: function disable() {
            hider.hide(this.$form);
            this.$button.prop('disabled', true)
                .addClass('disabled');
        },

        /**
         * Show the button
         */
        show: function show() {
            hider.show(this.$button);
        },

        /**
         * Hide the button
         */
        hide: function hide() {
            hider.hide(this.$form);
            hider.hide(this.$button);
        }
    });
});
