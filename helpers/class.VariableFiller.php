<?php

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
 * Copyright (c) 2013 (original work) Open Assessment Technologies SA (under the project TAO-PRODUCT);
 *
 *
 */

require_once dirname(__FILE__) . '/../lib/qtism/qtism.php';

use qtism\common\datatypes\Point;
use qtism\runtime\common\MultipleContainer;
use qtism\runtime\common\OrderedContainer;
use qtism\common\enums\Cardinality;
use qtism\common\datatypes\Pair;
use qtism\common\datatypes\DirectedPair;
use qtism\common\enums\BaseType;
use qtism\runtime\common\ResponseVariable;
use qtism\runtime\common\OutcomeVariable;
use qtism\runtime\common\Variable;
use qtism\data\ExtendedAssessmentItemRef;

/**
 * The VariableFiller provides a way to fill a QtiSm Runtime Variable with
 * a value coming from the client side. These values are always transmitted as
 * plain strings. However, we need a way to transform these string values as 
 * QtiSm compliant variable values. This is the goal of this class.
 * 
 * @author Jérôme Bogaerts <jerome@taotesting.com>
 *
 */
class taoQtiTest_helpers_VariableFiller {
    
    /**
     * The description of the item the variables belong to.
     * 
     * @var ExtendedAssessmentItemRef
     */
    private $itemRef;
    
    /**
     * Create a new VariableFiller object.
     * 
     * @param ExtendedAssessmentItemRef $itemRef The item the variables you want to fill belong to.
     */
    public function __construct(ExtendedAssessmentItemRef $itemRef) {
        $this->setItemRef($itemRef);
    }
    
    /**
     * Get the item reference the variables you want to fill belong to.
     * 
     * @return ExtendedAssessmentItemRef An ExtendedAssessmentItemRef object.
     */
    protected function getItemRef() {
        return $this->itemRef;
    }
    
    /**
     * Set the item reference the variables you want to fill belong to.
     * 
     * @param ExtendedAssessmentItemRef $itemRef An ExtendedAssessmentItemRef object.
     */
    protected function setItemRef(ExtendedAssessmentItemRef $itemRef) {
        $this->itemRef = $itemRef;
    }
    
    /**
     * Fille the variable $variableName with a correctly transformed
     * $clientSideValue.
     * 
     * @param string $variableName The variable identifier you want to fill.
     * @param string $clientSideValue The value received from the client-side.
     * @return Variable A Variable object filled with a correctly transformed $clientSideValue.
     * @throws OutOfBoundsException If no variable with $variableName is described in the item.
     * @throws InvalidArgumentException If $clientSideValue does not fit with the baseType of $variableName.
     */
    public function fill($variableName, $clientSideValue) {
        $variable = null;
        
        $outcomeDeclarations = $this->getItemRef()->getOutcomeDeclarations();
        $responseDeclarations = $this->getItemRef()->getResponseDeclarations();
        
        if (isset($responseDeclarations[$variableName]) === true) {
            $variable = ResponseVariable::createFromDataModel($responseDeclarations[$variableName]);
        }
        else if (isset($outcomeDeclarations[$variableName]) === true) {
            $variable = OutcomeVariable::createFromDataModel($outcomeDeclarations[$variableName]);
        }
        
        if (empty($variable) === true) {
            $itemId = $this->getItemRef()->getIdentifier();
            $msg = "No variable declaration '${variableName}' found in '${itemId}'.";
            throw new OutOfBoundsException($msg);
        }
        
        common_Logger::d("Filling variable '" . $variable->getIdentifier() . "'.");
        
        if (is_array($clientSideValue) === false) {
            $clientSideValue = array($clientSideValue);
        }
        
        try {
            $finalValues = array();
            foreach ($clientSideValue as $val) {
                $finalValues[] = self::transform($variable->getBaseType(), $val);
            }
            
            if ($variable->getCardinality() === Cardinality::SINGLE) {
                $variable->setValue($finalValues[0]);
            }
            else if ($variable->getCardinality() === Cardinality::MULTIPLE) {
                $variable->setValue(new MultipleContainer($variable->getBaseType(), $finalValues));
            }
            else {
                // Cardinality is ORDERED.
                $variable->setValue(new OrderedContainer($variable->getBaseType(), $finalValues));
            }
            
            return $variable;
        }
        catch (InvalidArgumentException $e) {
            if (is_array($clientSideValue)) {
                $clientSideValue = implode(',', $clientSideValue);
            }
            
            $msg = "An error occured while filling variable '${variableName}' with client-side value '${clientSideValue}'.";
            throw new InvalidArgumentException($msg, 0, $e); 
        }
    }
    
    /**
     * Transform $value in a $baseType datatype.
     * 
     * @param integer $baseType
     * @param mixed $value
     * @return mixed
     * @throws InvalidArgumentException If $baseType is unknown.
     */
    protected static function transform($baseType, $value) {
        
        switch ($baseType) {
            case BaseType::BOOLEAN:
                return ($value === 'true') ? true : false;
            break;
            
            case BaseType::DIRECTED_PAIR:
                common_Logger::d("Value '" . $value[0] . "," . $value[1] . "' transformed into directedPair.");
                return new DirectedPair($value[0], $value[1]);
            break;
            
            case BaseType::PAIR:
                common_Logger::d("Value '" . $value[0] . "," . $value[1] . "' transformed into pair.");
                return new Pair($value[0], $value[1]);
            break;
            
            case BaseType::STRING:
                common_Logger::d("Value '${value}' transformed into string.");
                return $value;
            break;
            
            case BaseType::IDENTIFIER:
                common_Logger::d("Value '${value}' transformed into identifier.");
                return $value;
            break;
            
            case BaseType::INTEGER:
                common_Logger::d("Value '${value}' transformed into integer.");
                return intval($value);
            break;
            
            case BaseType::FLOAT:
                common_Logger::d("Value '${value}' transformed into float.");
                return floatval($value);
            break;
            
            case BaseType::POINT:
                common_Logger::d("Value '" . $value[0] . "," . $value[1] . "' transformed into point.");
                return new Point(intval($value[0]), intval($value[1]));
            break;
            
            default:
                $msg = "Not supported baseType constant '${baseType}'.";
                throw new InvalidArgumentException($msg);
            break;
        }
    }
}