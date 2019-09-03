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

const base64SliderInteractionTest = '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';

export default base64SliderInteractionTest;
