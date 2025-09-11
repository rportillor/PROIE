// SIMPLE EXTRACTION THAT WILL WORK
import { storage } from './server/storage.js';
import { ConstructionWorkflowProcessor } from './server/construction-workflow-processor.js';

const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';
const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';

async function extractAll() {
  console.log('🚀 SIMPLE EXTRACTION STARTING...');
  
  const processor = new ConstructionWorkflowProcessor();
  const docs = await storage.getDocumentsByProject(projectId);
  console.log(`📁 Found ${docs.length} documents to process\n`);
  
  let totalExtracted = 0;
  
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    console.log(`[${i+1}/${docs.length}] Processing: ${doc.filename}`);
    
    try {
      const result = await processor.extractProductsFromSpec(doc, {
        modelId,
        batch: i + 1,
        totalBatches: docs.length
      });
      
      if (result && result.length > 0) {
        totalExtracted += result.length;
        console.log(`   ✅ Extracted ${result.length} elements`);
      } else {
        console.log(`   ⏭️ No elements found`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Error: ${error.message}`);
      // Continue to next document
    }
    
    // Brief pause to avoid overload
    await new Promise(r => setTimeout(r, 500));
  }
  
  const finalCount = await storage.getBimElements(modelId);
  console.log('\n✅ EXTRACTION COMPLETE!');
  console.log(`   Total elements in database: ${finalCount.length}`);
  console.log(`   Elements extracted this run: ${totalExtracted}`);
}

// Run it
extractAll().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});