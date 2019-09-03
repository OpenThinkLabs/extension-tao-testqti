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
 * QTI test package with:
 * - single item
 * - single hottext interaction
 */
const base64Test = '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';

export default base64Test;
