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

import runnerSelectors from '../../_helpers/selectors/runnerSelectors';

import '../../_helpers/commands/setupCommands';
import '../../_helpers/commands/cleanupCommands';
import '../../_helpers/routes/backOfficeRoutes';

import base64Test from './fixtures/base64TestTakerToolsTestPackage';

describe('Tools', () => {

    /**
     * Setup to have a proper delivery:
     * - Start server
     * - Add necessary routes
     * - Admin login
     * - Import test package
     * - Publish imported test as a delivery
     * - Set guest access on delivery and save
     * - Logout
     */
    before(() => {
        cy.setupServer();
        cy.addBackOfficeRoutes();
        cy.login('admin');
        cy.importTestPackage(base64Test, 'e2e Tools test');
        cy.publishTest('e2e Tools test');
        cy.setDeliveryForGuests('e2e Tools test');
        cy.logout();
    });

    /**
     * Log in & start the test
     */
    beforeEach(() => {
        cy.guestLogin();
        // cy.startTest('e2e Tools test'); // TODO:
    });

    /**
     * Log out
     */
    afterEach(() => {
        cy.guestLogout();
    });

    /**
     * Destroy everything we created during setup, leaving the environment clean for next time.
     */
    after(() => {
        cy.guestLogout();
        cy.login('admin');
        cy.deleteItem('e2e Tools test');
        cy.deleteTest('e2e Tools test');
        cy.deleteDelivery('Delivery of e2e Tools test');
    });

    /**
     * Tools tests
     */
    describe('Test-Taker Tools', () => {

        it('List contains Tools e2e delivery', function() {
            cy.get(runnerSelectors.testList).find(runnerSelectors.availableDeliveries).contains('Delivery of e2e Tools test');
        });
    });
});
