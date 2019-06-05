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
 * Copyright (c) 2019 (original work) Open Assessment Technologies SA ;
 */
/**
 * @author Péter Halász <peter@taotesting.com>
 */
define([
    'lodash',
    'i18n',
    'core/promise',
    'taoQtiTest/runner/branchRule/branchRule',
    'taoQtiTest/runner/helpers/map'
], function (
    _,
    __,
    Promise,
    branchRule,
    mapHelper
) {
    'use strict';

    /**
     * Jump table entry definition.
     *
     * @typedef Jump
     * @property {string} item      - the identifier of the item
     * @property {string} section   - the identifier of the section
     * @property {string} part      - the identifier of the part
     * @property {integer} position - the position of the jump entry, starting from 0
     */
    /**
     * Helper class for the offline version of the jump table which helps the navigation of the test taker.
     */
    var offlineJumpTableFactory = function offlineJumpTableFactory(itemStore, responseStore) {
        var testMap = {};
        var jumpTable = [];

        /**
         * Put all the responses from the navigation parameters into the responseStore
         *
         * @param {Object} params
         */
        function addResponsesToResponseStore(params) {
            if (params.itemResponse) {
                _.forEach(params.itemResponse, function(response, itemResponseIdentifier) {
                    var responseIdentifier = params.itemDefinition + '.' + itemResponseIdentifier;

                    _.forEach(response, function(responseEntry) {
                        var responseId = responseEntry ?  responseEntry.identifier : undefined;

                        if (Array.isArray(responseId)) {
                            responseId.forEach(function(id) {
                                responseStore.addResponse(responseIdentifier, id);
                            });
                        } else {
                            responseStore.addResponse(responseIdentifier, responseId);
                        }
                    });
                });
            }
        }

        /**
         * Returns all the item identifiers in order.
         *
         * @param {Object} map
         * @returns {Array}
         */
        function getItems(map) {
            return _.uniq(_.map(getSimplifiedTestMap(map), function(row) {
                return row.item;
            }));
        }

        /**
         * Returns all the section identifiers in order.
         *
         * @param {Object} map
         * @returns {Array}
         */
        function getSections(map) {
            return _.uniq(_.map(getSimplifiedTestMap(map), function(row) {
                return row.section;
            }));
        }

        /**
         * Returns a simplified test map array, which will contain the item, section and part identifiers.
         *
         * @param {Object} map
         * @returns {Array}
         */
        function getSimplifiedTestMap(map) {
            var simplifiedTestMap = [];

            mapHelper.each(map, function(item, section, part) {
                simplifiedTestMap.push({
                    item: item.id,
                    itemHasBranchRule: !_.isEmpty(item.branchRule),
                    itemBranchRule: item.branchRule,
                    section: section.id,
                    sectionHasBranchRule: !_.isEmpty(section.branchRule),
                    sectionBranchRule: section.branchRule,
                    part: part.id,
                    partHasBranchRule: !_.isEmpty(part.branchRule),
                    partBranchRule: part.branchRule
                });
            });

            return simplifiedTestMap;
        }

        return {
            /**
             * Setter for test map
             *
             * @param {Object} map
             * @returns {offlineJumpTableFactory}
             */
            setTestMap: function setTestMap(map) {
                testMap = map;

                return this;
            },

            /**
             * Initialization method for the offline jump table, which is responsible to add the first item as the first
             * jump and collect the correct responses for the branching rules.
             * @param {Object} [testContext] - current test context is needed in order to continue test after interruption
             */
            init: function init(testContext) {
                var firstItem;
                var simplifiedTestMap = getSimplifiedTestMap(testMap);
                var self = this;
                var contextItemId =  testContext ? testContext.itemIdentifier : null;
                var contextItemPosition =  contextItemId ? testContext.itemPosition : null;
                var reducedTestMap = [];
                var isTestMapResuced = false;

                // reducer to filter out all test items before current
                var testMapReducer = function testMapReducer (accumulator,current) {

                    if (!isTestMapResuced){
                        accumulator.push(current);
                        if (current.item === contextItemId){
                            isTestMapResuced = true;
                        }
                    }
                    return accumulator;
                };

                /**
                 * if the jump table is empty, it adds the first item as the first jump
                 * or put previous from current to jump table. Current item id is taken from test context
                 */
                if (simplifiedTestMap.length > 0 && jumpTable.length === 0 ) {

                    if(contextItemId && contextItemPosition){
                        reducedTestMap =  simplifiedTestMap.reduce(testMapReducer, []);
                        _.forEach(reducedTestMap, function(item) {
                            self.addJump(item.part, item.section, item.item);
                        });
                    }else{
                        firstItem = simplifiedTestMap[0];
                        this.addJump(firstItem.part, firstItem.section, firstItem.item);
                    }
                }

                // Put all correct responses to the responseStore
                simplifiedTestMap.forEach(function(row) {
                    itemStore.get(row.item)
                        .then(function(item) {
                            if (item) {
                                _.forEach(item.itemData.data.responses, function(response) {
                                    var responseIdentifier = item.itemIdentifier + '.' + response.identifier;

                                    responseStore.addCorrectResponse(responseIdentifier, response.correctResponses);
                                });
                            }
                        })
                        .catch(function(err) {
                            return Promise.reject(err);
                        });
                });
            },

            /**
             * Clears the jump table
             *
             * @returns {offlineJumpTableFactory}
             */
            clearJumpTable: function clearJumpTable() {
                jumpTable = [];

                return this;
            },

            /**
             * Adds a new jump into the end of the jump table
             *
             * @param {String} partIdentifier
             * @param {String} sectionIdentifier
             * @param {String} itemIdentifier
             */
            addJump: function addJump(partIdentifier, sectionIdentifier, itemIdentifier) {
                var self = this;

                return new Promise(function(resolve) {
                    var lastJump = self.getLastJump();
                    var nextPosition = typeof lastJump.position !== 'undefined' ? lastJump.position + 1 : 0;

                    jumpTable.push({
                        item: itemIdentifier,
                        part: partIdentifier,
                        section: sectionIdentifier,
                        position: nextPosition
                    });

                    resolve();
                });
            },

            /**
             * Jumps into a specific position inside the jump table. The jump entry in the given position
             * will be the last element of the jump table, every other entry after this entry will get deleted
             *
             * @param {Integer} position
             * @returns {offlineJumpTableFactory}
             */
            jumpTo: function jumpTo(position) {
                jumpTable = jumpTable.filter(function(jump) {
                    return jump.position <= position;
                });

                return this;
            },

            /**
             * Jumps to the next item without taking the branching rules into account
             *
             * @returns {Promise}
             */
            jumpToSkipItem: function jumpToSkipItem() {
                var self = this;

                return new Promise(function(resolve) {
                    var simplifiedTestMap = getSimplifiedTestMap(testMap);
                    var lastJumpItem = self.getLastJump().item || null;
                    var items = getItems(testMap);
                    var itemSliceIndex = items.indexOf(lastJumpItem);
                    var itemIdentifierToAdd = items.slice(itemSliceIndex + 1).shift();
                    var itemToAdd = simplifiedTestMap
                        .filter(function(row) {
                            return row.item === itemIdentifierToAdd;
                        })
                        .shift();

                    if (itemToAdd) {
                        return self.addJump(itemToAdd.part, itemToAdd.section, itemToAdd.item).then(resolve);
                    } else {
                        return resolve();
                    }
                });
            },

            /**
             * Adds the next item to the end of the jump table
             *
             * @param {Object} params
             * @returns {Promise}
             */
            jumpToNextItem: function jumpToNextItem(params) {
                var self = this;

                addResponsesToResponseStore(params);

                return new Promise(function(resolve) {
                    var simplifiedTestMap = getSimplifiedTestMap(testMap);
                    var lastJumpItem = self.getLastJump().item || null;
                    var items = getItems(testMap);
                    var itemSliceIndex = items.indexOf(lastJumpItem);
                    var itemIdentifierToAdd = items.slice(itemSliceIndex + 1).shift();
                    var itemToAdd = simplifiedTestMap
                        .filter(function(row) {
                            return row.item === itemIdentifierToAdd;
                        })
                        .shift();

                    var lastJumpItemData = simplifiedTestMap
                        .filter(function(row) {
                            return row.item === lastJumpItem;
                        })
                        .shift();

                    if (lastJumpItemData && lastJumpItemData.itemHasBranchRule) {
                        return itemStore.get(lastJumpItem)
                            .then(function(item) {
                                branchRule(lastJumpItemData.itemBranchRule, item, params, responseStore)
                                     .then(function(itemIdentifierToAddd) {
                                         if (itemIdentifierToAddd !== null) {
                                             itemToAdd = simplifiedTestMap
                                                 .filter(function(row) {
                                                     return row.item === itemIdentifierToAddd;
                                                 })
                                                 .shift();
                                         }

                                         self.addJump(itemToAdd.part, itemToAdd.section, itemToAdd.item).then(resolve);
                                     })
                                     .catch(function(err) {
                                         return Promise.reject(err);
                                     });
                            })
                            .catch(function(err) {
                                return Promise.reject(err);
                            });
                    } else {
                        if (itemToAdd) {
                            return self.addJump(itemToAdd.part, itemToAdd.section, itemToAdd.item).then(resolve);
                        } else {
                            return resolve();
                        }
                    }
                });
            },

            /**
             * Adds the first item of the next section to the end of the jump table
             *
             * @param {Object} [params]]
             * @returns {Promise}
             */
            jumpToNextSection: function jumpToNextSection(params) {
                var self = this;

                return new Promise(function(resolve) {
                    var simplifiedTestMap = getSimplifiedTestMap(testMap);
                    var lastJumpSection = self.getLastJump().section || null;
                    var sections = getSections(testMap);
                    var sectionSliceIndex = sections.indexOf(lastJumpSection);
                    var sectionIdentifierToAdd = sections.slice(sectionSliceIndex + 1).shift();
                    var itemToAdd = simplifiedTestMap
                        .filter(function(row) {
                            return row.section === sectionIdentifierToAdd;
                        })
                        .shift();

                    if (itemToAdd) {
                        return self.addJump(itemToAdd.part, itemToAdd.section, itemToAdd.item).then(resolve);
                    } else {
                        return resolve();
                    }
                });
            },

            /**
             * Jumps to the previous item by deleting the last entry of the jump table.
             *
             * @param {Object} [params]
             * @returns {Promise}
             */
            jumpToPreviousItem: function jumpToPreviousItem(params) {
                return new Promise(function(resolve) {
                    jumpTable.pop();

                    resolve();
                });
            },

            /**
             * Returns the jump table.
             *
             * @returns {Jump[]}
             */
            getJumpTable: function getJumpTable() {
                return jumpTable;
            },

            /**
             * Returns the last entry of the jump table which represent the current state of the navigation.
             *
             * @returns {Jump}
             */
            getLastJump: function getLastJump() {
                return jumpTable.length > 0
                    ? jumpTable[jumpTable.length - 1]
                    : {};
            }
        };
    };

    return offlineJumpTableFactory;
});
