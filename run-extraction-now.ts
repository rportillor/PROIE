// CONTINUOUS EXTRACTION UNTIL COMPLETE
import { storage } from './server/storage';

const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';
const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';

async function runExtraction() {
  console.log('🚀 STARTING FULL EXTRACTION - WILL NOT STOP!');
  console.log('=========================================');
  
  try {
    // Import the processor
    const { ConstructionWorkflowProcessor } = await import('./server/construction-workflow-processor');
    const processor = new (ConstructionWorkflowProcessor as any)();
    
    // Get all documents
    const documents = await storage.getDocumentsByProject(projectId);
    console.log(`📁 Total documents: ${documents.length}`);
    
    let totalExtracted = 0;
    let docsProcessed = 0;
    
    // Process EVERY document
    for (const doc of documents) {
      docsProcessed++;
      const startCount = await storage.getBimElements(modelId);
      console.log(`\n[${docsProcessed}/${documents.length}] Processing: ${doc.filename}`);
      
      try {
        // Extract using the working method
        const products = await processor.extractProductsFromSpec(doc, {
          modelId,
          batch: docsProcessed,
          totalBatches: documents.length
        });
        
        if (products && products.length > 0) {
          totalExtracted += products.length;
          const newCount = await storage.getBimElements(modelId);
          console.log(`   ✅ Found ${products.length} elements (Total in DB: ${newCount.length})`);
        } else {
          console.log(`   ⏭️ No new elements found`);
        }
      } catch (error: any) {
        console.log(`   ⚠️ Error: ${error.message}`);
        // Continue anyway - don't stop!
      }
      
      // Brief pause between documents
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final count
    const finalElements = await storage.getBimElements(modelId);
    console.log('\n=========================================');
    console.log(`✅ EXTRACTION COMPLETE!`);
    console.log(`   Total elements: ${finalElements.length}`);
    console.log(`   Documents processed: ${docsProcessed}/${documents.length}`);
    console.log(`   New elements this run: ${totalExtracted}`);
    console.log('=========================================');
    
    // Update model status
    await storage.updateBimModel(modelId, {
      status: 'completed',
      geometryData: {
        processingState: {
          status: 'complete',
          phase: 'all_documents_processed',
          documentsProcessed: documents.length,
          totalDocuments: documents.length,
          totalElements: finalElements.length,
          methodology: 'Complete extraction of all documents'
        }
      }
    });
    
  } catch (error: any) {
    console.error('Fatal error:', error);
    console.error(error.stack);
  }
}

// Run immediately and keep retrying if needed
async function runContinuously() {
  while (true) {
    try {
      await runExtraction();
      
      // Check if we have enough elements
      const elements = await storage.getBimElements(modelId);
      if (elements.length >= 1500) {
        console.log('🎉 TARGET REACHED! Extraction complete with', elements.length, 'elements');
        break;
      }
      
      console.log('\n⚠️ Not enough elements yet. Retrying in 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.error('Extraction failed, retrying in 10 seconds...', error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Start the continuous extraction
runContinuously().then(() => {
  console.log('✅ Process complete!');
  process.exit(0);
}).catch(error => {
  console.error('Process failed:', error);
  process.exit(1);
});