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
 * Copyright (c) 2013-2014 (original work) Open Assessment Technologies SA (under the project TAO-PRODUCT);
 * 
 */

use qtism\runtime\rendering\markup\xhtml\XhtmlRenderingEngine;
use qtism\runtime\rendering\css\CssScoper;
use qtism\data\storage\php\PhpDocument;
use qtism\data\QtiComponentIterator;
use qtism\data\storage\xml\XmlDocument;
use qtism\data\storage\xml\XmlCompactDocument;
use qtism\data\AssessmentTest;
use qtism\data\content\RubricBlockRef;
use qtism\data\state\OutcomeDeclaration;
use qtism\data\state\DefaultValue;
use qtism\data\state\Value;
use qtism\data\state\ValueCollection;
use qtism\common\enums\BaseType;
use qtism\common\enums\Cardinality;

/**
 * A Test Compiler implementation that compiles a QTI Test and related QTI Items.
 *
 * @author Jérôme Bogaerts <jerome@taotesting.com>
 * @package taoQtiTest
 * @subpackage models_classes
 */
class taoQtiTest_models_classes_QtiTestCompiler extends taoTests_models_classes_TestCompiler
{
    
    /**
     * The list of mime types of files that are accepted to be put
     * into the public compilation directory.
     * 
     * @var array
     */
    private static $publicMimeTypes = array('text/css',
                                               'image/png', 
                                               'image/jpeg', 
                                               'image/gif', 
                                               'text/html',
                                               'application/x-shockwave-flash',
                                               'video/x-flv',
                                               'image/bmp',
                                               'image/svg+xml',
                                               'audio/mpeg',
                                               'audio/ogg',
                                               'video/quicktime',
                                               'video/webm',
                                               'video/ogg',
                                               'application/pdf',
                                               'application/x-font-woff',
                                               'application/vnd.ms-fontobject',
                                               'application/x-font-ttf');
   
    /**
     * The public compilation directory.
     * 
     * @var tao_models_classes_service_StorageDirectory
     */
    private $publicDirectory = null;
    
    /**
     * The private compilation directory.
     * 
     * @var tao_models_classes_service_StorageDirectory
     */
    private $privateDirectory = null;
    
    /**
     * The rendering engine that will be used to create rubric block templates.
     * 
     * @var XhtmlRenderingEngine
     */
    private $renderingEngine = null;
    
    /**
     * The CSS Scoper will scope CSS files to their related rubric block.
     * 
     * @var CssScoper
     */
    private $cssScoper = null;
    
    /**
     * Get the public compilation directory.
     * 
     * @return tao_models_classes_service_StorageDirectory
     */
    protected function getPublicDirectory() {
        return $this->publicDirectory;
    }
    
    /**
     * Set the public compilation directory.
     * 
     * @param tao_models_classes_service_StorageDirectory $directory
     */
    protected function setPublicDirectory(tao_models_classes_service_StorageDirectory $directory) {
        $this->publicDirectory = $directory;
    }
    
    /**
     * Get the private compilation directory.
     * 
     * @return tao_models_classes_service_StorageDirectory
     */
    protected function getPrivateDirectory() {
        return $this->privateDirectory;
    }
    
    /**
     * Set the private compilation directory.
     * 
     * @param tao_models_classes_service_StorageDirectory $directory
     */
    protected function setPrivateDirectory(tao_models_classes_service_StorageDirectory $directory) {
        $this->privateDirectory = $directory;
    }
    
    /**
     * Get the rendering engine that will be used to render rubric block templates.
     * 
     * @return XhtmlRenderingEngine
     */
    protected function getRenderingEngine() {
        return $this->renderingEngine;
    }
    
    /**
     * Set the rendering engine that will be used to render rubric block templates.
     * 
     * @param XhtmlRenderingEngine $renderingEngine
     */
    protected function setRenderingEngine(XhtmlRenderingEngine $renderingEngine) {
        $this->renderingEngine = $renderingEngine;
    }
    
    /**
     * Get the CSS Scoper tool that will scope CSS files to their related rubric block.
     * 
     * @return CssScoper
     */
    protected function getCssScoper() {
        return $this->cssScoper;
    }
    
    /**
     * Set the CSS Scoper tool that will scope CSS files to their related rubric block.
     * 
     * @param CssScoper $cssScoper
     */
    protected function setCssScoper(CssScoper $cssScoper) {
        $this->cssScoper = $cssScoper;
    }
    
    /**
     * Initialize the compilation by:
     * 
     * * 1. Spawning public and private compilation directoryies.
     * * 2. Instantiating appropriate rendering engine and CSS utilities.
     * 
     * for the next compilation process.
     */
    protected function initCompilation() {
        // Initialize public and private compilation directories.
        $this->setPrivateDirectory($this->spawnPrivateDirectory());
        $this->setPublicDirectory($this->spawnPublicDirectory());
        
        // Initialize rendering engine.
        $renderingEngine = new XhtmlRenderingEngine();
        $renderingEngine->setStylesheetPolicy(XhtmlRenderingEngine::STYLESHEET_SEPARATE);
        $renderingEngine->setXmlBasePolicy(XhtmlRenderingEngine::XMLBASE_PROCESS);
        $renderingEngine->setRootBase('tao://qti-directory');
        $this->setRenderingEngine($renderingEngine);
        
        // Initialize CSS Scoper.
        $this->setCssScoper(new CssScoper());
    }
    
    /**
     * Compile a QTI Test and the related QTI Items.
     * 
     * The compilation process occurs as follows:
     * 
     * * 1. The resources composing the test are copied into the private compilation directory.
     * * 2. The test definition is packed (test and items put together in a single definition).
     * * 3. The items composing the test are compiled.
     * * 4. The rubric blocks are rendered into PHP templates.
     * * 5. The test definition is compiled into PHP source code for maximum performance.
     * * 6. The resources composing the test that have to be accessed at delivery time are compied into the public compilation directory.
     * * 7. The Service Call definition enabling TAO to run the compiled test is built.
     * 
     * @param core_kernel_file_File $destinationDirectory The directory where the compiled files must be put.
     * @return tao_models_classes_service_ServiceCall A ServiceCall object that represent the way to call the newly compiled test.
     * @throws tao_models_classes_CompilationFailedException If an error occurs during the compilation.
     */
    public function compile() {
        
        // 0. Initialize compilation (compilation directories, renderers, ...).
        $this->initCompilation();
        
        // 1. Copy the resources composing the test into the private complilation directory.
        $this->copyPrivateResources();
        
        // 2. Compact the test definition itself.
        $compiledDoc = $this->compactTest();
        
        // 3. Compile the items of the test.
        $this->compileItems($compiledDoc);
        
        // 4. Explode the rubric blocks in the test into rubric block refs.
        $this->explodeRubricBlocks($compiledDoc);
        
        // 5. Update test definition with additional runtime info.
        $assessmentTest = $compiledDoc->getDocumentComponent();
        $this->updateTestDefinition($assessmentTest);
        
        // 6. Compile rubricBlocks and serialize on disk.
        $rubricBlockRefs = $assessmentTest->getComponentsByClassName('rubricBlockRef');
        
        foreach ($rubricBlockRefs as $rubric) {
            $this->compileRubricBlock($rubric);
        }
        
        // 7. Compile the test definition into PHP source code and put it
        // into the private directory.
        $this->compileTest($assessmentTest);

        // 8. Copy the needed files into the public directory.
        $this->copyPublicResources(); 
        
        // 9. Build the service call.
        $serviceCall = $this->buildServiceCall();
        
        common_Logger::t("QTI Test successfuly compiled.");
        
        return $serviceCall;
    }
    
    /**
     * Compact the test and items in a single QTI-XML Compact Document.
     * 
     * @return XmlCompactDocument.
     */
    protected function compactTest() {
        $testService = taoQtiTest_models_classes_QtiTestService::singleton();
        $test = $this->getResource();
        $testContent = $testService->getTestContent($test);
        
        common_Logger::t('Compacting QTI test ' . $test->getLabel() . '.');
        
        $itemResolver = new taoQtiTest_helpers_ItemResolver('');
        $originalDoc = $testService->getDoc($test);
        
        common_Logger::t("QTI Test XML document successfully loaded.");
        
        $compiledDoc = XmlCompactDocument::createFromXmlAssessmentTestDocument($originalDoc, $itemResolver);
        common_Logger::t("QTI Test XML document successfuly transformed in a compact version.");
        
        return $compiledDoc;
    }
    
    /**
     * Compile the items referended by $compactDoc.
     * 
     * @param XmlCompactDocument $compactDoc An XmlCompactDocument object referencing the items of the test.
     * @throws taoQtiTest_models_classes_QtiTestCompilationFailedException If the test does not refer to at least one item.
     */
    protected function compileItems(XmlCompactDocument $compactDoc) {
        $iterator = new QtiComponentIterator($compactDoc->getDocumentComponent(), array('assessmentItemRef'));
        $itemCount = 0;
        foreach ($iterator as $assessmentItemRef) {
            $itemToCompile = new core_kernel_classes_Resource($assessmentItemRef->getHref());
            $itemService = $this->subCompile($itemToCompile);
            $inputValues = tao_models_classes_service_ServiceCallHelper::getInputValues($itemService, array());
            $assessmentItemRef->setHref($inputValues['itemUri'] . '|' . $inputValues['itemPath'] . '|' . $this->getResource()->getUri());
            $itemCount++;
        
            common_Logger::t("QTI Item successfuly compiled and registered as a service call in the QTI Test Definition.");
        }
        
        if ($itemCount === 0) {
            $msg = "A QTI Test must contain at least one QTI Item to be compiled. None found.";
            $code = taoQtiTest_models_classes_QtiTestCompilationFailedException::NO_ITEMS;
            throw new taoQtiTest_models_classes_QtiTestCompilationFailedException($msg, $test, $code);
        }
    }
    
    /**
     * Explode the rubric blocks of the test definition into separate QTI-XML files and
     * remove the compact XML document from the file system (useless for
     * the rest of the compilation process).
     * 
     * @param XmlCompactDocument $compiledDoc
     */
    protected function explodeRubricBlocks(XmlCompactDocument $compiledDoc) {
        $savePath = $this->getPrivateDirectory()->getPath() . 'compact-test.xml';
        $compiledDoc->setExplodeRubricBlocks(true);
        $compiledDoc->save($savePath);
        unlink($savePath);
    }
    
    /**
     * Update the test definition with additional data, such as TAO specific
     * rules and variables.
     * 
     * @param AssessmentTest $assessmentTest
     */
    protected function updateTestDefinition(AssessmentTest $assessmentTest) {
        $outcomeDeclarations = $assessmentTest->getOutcomeDeclarations();
        $outcomeDeclarations[] = new OutcomeDeclaration('LtiOutcome', BaseType::FLOAT, Cardinality::SINGLE, new DefaultValue(new ValueCollection(array(new Value(0.0, BaseType::FLOAT)))));
    }
    
    /**
     * Copy the resources (e.g. images) of the test to the private compilation directory.
     */
    protected function copyPrivateResources() {
        $testService = taoQtiTest_models_classes_QtiTestService::singleton();
        $testPath = $testService->getTestContent($this->getResource())->getAbsolutePath();
        
        $subContent = tao_helpers_File::scandir($testPath, array('recursive' => false, 'absolute' => true));
        $privateDirPath = $this->getPrivateDirectory()->getPath();
        foreach ($subContent as $subC) {
            tao_helpers_File::copy($subC, $privateDirPath . basename($subC));
        }
    }
    
    /**
     * Build the Service Call definition that makes TAO able to run the compiled test
     * later on at delivery time.
     * 
     * @return tao_models_classes_service_ServiceCall
     */
    protected function buildServiceCall() {
        $service = new tao_models_classes_service_ServiceCall(new core_kernel_classes_Resource(INSTANCE_QTITEST_TESTRUNNERSERVICE));
        $param = new tao_models_classes_service_ConstantParameter(
                        // Test Definition URI passed to the QtiTestRunner service.
                        new core_kernel_classes_Resource(INSTANCE_FORMALPARAM_QTITEST_TESTDEFINITION),
                        $this->getResource()
        );
        $service->addInParameter($param);
        
        $param = new tao_models_classes_service_ConstantParameter(
                        // Test Compilation URI passed to the QtiTestRunner service.
                        new core_kernel_classes_Resource(INSTANCE_FORMALPARAM_QTITEST_TESTCOMPILATION),
                        $this->getPrivateDirectory()->getId() . '|' . $this->getPublicDirectory()->getId()
        );
        $service->addInParameter($param);
        
        return $service;
    }
    
    /**
     * Compile a given RubricBlocRef's content into a separate rubric block PHP template.
     * 
     * @param RubricBlockRef $rubric
     */
    protected function compileRubricBlock(RubricBlockRef $rubric) {
        $cssScoper = $this->getCssScoper();
        $renderingEngine = $this->getRenderingEngine();
        $compiledDocDir = $this->getPrivateDirectory()->getPath();
        $publicCompiledDocDir = $this->getPublicDirectory()->getPath();
        
        // -- loading...
        common_Logger::t("Loading rubricBlock '" . $rubric->getHref() . "'...");
        
        $rubricDoc = new XmlDocument();
        $rubricDoc->load($compiledDocDir . $rubric->getHref());
        
        common_Logger::t("rubricBlock '" . $rubric->getHref() . "' successfully loaded.");
        
        // -- rendering...
        common_Logger::t("Rendering rubricBlock '" . $rubric->getHref() . "'...");
        
        $pathinfo = pathinfo($rubric->getHref());
        $renderingFile = $compiledDocDir . $pathinfo['filename'] . '.php';
        
        $domRendering = $renderingEngine->render($rubricDoc->getDocumentComponent());
        $domRendering->formatOutput = true;
        $mainStringRendering = $domRendering->saveXML($domRendering->documentElement);
        
        $rubricDocStylesheets = $rubricDoc->getDocumentComponent()->getStylesheets();
        if (empty($rubricDocStylesheets) === false) {
            // Prepend stylesheets rendering to the main rendering.
            $styleRendering = $renderingEngine->getStylesheets();
            $mainStringRendering = $styleRendering->ownerDocument->saveXML($styleRendering) . $mainStringRendering;
        
            foreach ($rubricDocStylesheets as $rubricDocStylesheet) {
                $stylesheetPath = taoQtiTest_helpers_Utils::storedQtiResourcePath($compiledDocDir, $rubricDocStylesheet->getHref());
                file_put_contents($stylesheetPath, $cssScoper->render($stylesheetPath, $rubricDoc->getDocumentComponent()->getId()));
            }
        }
        
        // -- Replace the artificial 'tao://qti-directory' base path with a runtime call to the delivery time base path.
        $mainStringRendering = str_replace('tao://qti-directory/', '<?php echo $taoQtiBasePath; ?>', $mainStringRendering);
        file_put_contents($renderingFile, $mainStringRendering);
        common_Logger::t("rubricBlockRef '" . $rubric->getHref() . "' successfully rendered.");
        
        // -- Clean up old rubric block and reference the new rubric block template.
        unlink($compiledDocDir . $rubric->getHref());
        $rubric->setHref('./' . $pathinfo['filename'] . '.php');
    }
    
    /**
     * Copy the test resources (e.g. images) that will be availabe at delivery time
     * in the public compilation directory.
     */
    protected function copyPublicResources() {
        
        $compiledDocDir = $this->getPrivateDirectory()->getPath();
        $publicCompiledDocDir = $this->getPublicDirectory()->getPath();
        
        foreach (tao_helpers_File::scandir($compiledDocDir, array('recursive' => true, 'only' => tao_helpers_File::$FILE, 'absolute' => true)) as $file) {
            $mime = tao_helpers_File::getMimeType($file, true);
            $pathinfo = pathinfo($file);
            
            // Exclude CSS files because already copied when dealing with rubric blocks.
            if (in_array($mime, self::getPublicMimeTypes()) === true && $pathinfo['extension'] !== 'php') {
                $file = str_replace($compiledDocDir, '', $file);
                
                common_Logger::t("Copying public resource '${file}'...");
                taoQtiTest_helpers_Utils::storeQtiResource($publicCompiledDocDir, $file, $compiledDocDir);
            }
        }
    }
    
    /**
     * Compile the given $test into PHP source code for maximum performance. The file will be stored
     * into PRIVATE_DIRECTORY/compact-test.php.
     * 
     * @param AssessmentTest $test
     */
    protected function compileTest(AssessmentTest $test) {
        $compiledDocDir = $this->getPrivateDirectory()->getPath();
        $compiledDocPath = $compiledDocDir . 'compact-test.php';
        $phpCompiledDoc = new PhpDocument('2.1');
        $phpCompiledDoc->setDocumentComponent($test);
        $phpCompiledDoc->save($compiledDocPath);
        common_Logger::d("QTI-PHP Test Compilation file registered at '" . $compiledDocPath . "'.");
    }
    
    /**
     * Get the list of mime types of files that are accepted to be put
     * into the public compilation directory.
     * 
     * @return array
     */
    static protected function getPublicMimeTypes() {
        return self::$publicMimeTypes;
    }
}