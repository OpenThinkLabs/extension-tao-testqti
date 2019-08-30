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
 * QTI test packages with 3 items
 */

const base64NonLinearTest = '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';

export default base64NonLinearTest;
