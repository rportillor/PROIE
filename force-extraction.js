const storage = require('./server/storage').storage;
const ConstructionWorkflowProcessor = require('./server/construction-workflow-processor').ConstructionWorkflowProcessor;

const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';
const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';

async function forceExtract() {
  console.log('FORCE EXTRACTION STARTING...');
  
  const docs = await storage.getDocumentsByProject(projectId);
  console.log('Documents:', docs.length);
  
  const processor = new ConstructionWorkflowProcessor();
  
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    console.log(`[${i+1}/${docs.length}] ${doc.filename}`);
    
    try {
      const result = await processor.extractProductsFromSpec(doc, {
        modelId,
        batch: i + 1,
        totalBatches: docs.length
      });
      
      if (result && result.length > 0) {
        console.log(`  ✅ Saved ${result.length} elements`);
      }
    } catch (e) {
      console.log(`  ⚠️ Error: ${e.message}`);
    }
  }
  
  const total = await storage.getBimElements(modelId);
  console.log(`\nTOTAL ELEMENTS: ${total.length}`);
}

forceExtract().catch(console.error);
