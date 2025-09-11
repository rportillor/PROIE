import { storage } from './server/storage.js';
import { processBimDocumentWithClaude } from './server/services/claude-processor.js';

const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';
const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';

console.log('🚀 STARTING EXTRACTION - WILL NOT STOP UNTIL COMPLETE!');
console.log('============================================');

async function extractAll() {
  try {
    // Get all documents
    const documents = await storage.getProjectDocuments(projectId);
    console.log(`📁 Total documents: ${documents.length}`);
    
    let totalExtracted = 0;
    let docsProcessed = 0;
    
    // Process each document
    for (const doc of documents) {
      docsProcessed++;
      console.log(`\n[${docsProcessed}/${documents.length}] Processing: ${doc.fileName}`);
      
      try {
        // Get current elements
        const existingElements = await storage.getBimElements(modelId);
        
        // Extract from this document
        const result = await processBimDocumentWithClaude({
          documentId: doc.id,
          modelId,
          document: doc,
          existingElements,
          mode: 'extraction'
        });
        
        if (result && result.elementsFound > 0) {
          totalExtracted += result.elementsFound;
          console.log(`  ✅ Found ${result.elementsFound} elements (Total: ${existingElements.length + result.elementsFound})`);
        } else {
          console.log(`  ⏭️ No new elements found`);
        }
      } catch (error) {
        console.log(`  ⚠️ Error processing document: ${error.message}`);
      }
      
      // Brief pause between documents to avoid overload
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final count
    const finalElements = await storage.getBimElements(modelId);
    console.log('\n============================================');
    console.log(`✅ EXTRACTION COMPLETE!`);
    console.log(`   Total elements: ${finalElements.length}`);
    console.log(`   Documents processed: ${docsProcessed}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run immediately
extractAll().then(() => {
  console.log('Process finished');
  process.exit(0);
}).catch(error => {
  console.error('Process failed:', error);
  process.exit(1);
});