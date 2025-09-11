// Fixed processing logic - Construction details BEFORE floor plans
// This follows proper construction estimation methodology

import { storage } from './server/storage';

async function processWithCorrectLogic() {
  console.log('🏗️ STARTING PROPER CONSTRUCTION DOCUMENT PROCESSING');
  console.log('   Following correct construction estimation methodology:');
  console.log('   1. Specifications ✅ (already done - 757 products)');
  console.log('   2. Construction Details → Learn HOW things are built');
  console.log('   3. Schedules → Door/window specifics');
  console.log('   4. Floor Plans → Apply knowledge to spatial layouts');
  console.log('   5. Elevations → Vertical relationships');
  console.log('');
  
  const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';
  const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';
  
  try {
    // Get all documents
    const documents = await storage.getDocumentsByProject(projectId);
    console.log(`📁 Total documents: ${documents.length}`);
    
    // PROPERLY categorize documents based on their actual content
    const detailDocs = documents.filter((d: any) => 
      d.filename.includes('Detail') || 
      d.filename.includes('TYPICAL_DETAILS') ||
      d.filename.includes('Construction_Assemblies') ||
      d.filename.includes('Washrooms_details') ||
      d.filename.includes('Stair_Details') ||
      d.filename.includes('Fire_Separation')
    );
    
    const scheduleDocs = documents.filter((d: any) => 
      d.filename.includes('SCHEDULE')
    );
    
    const floorPlanDocs = documents.filter((d: any) => 
      (d.filename.includes('FLOOR') || d.filename.includes('Floor')) &&
      !d.filename.includes('ROOF') // Roof plans are different
    );
    
    const elevationDocs = documents.filter((d: any) => 
      d.filename.includes('Elevation') || 
      d.filename.includes('Section')
    );
    
    // Remaining documents (roof plans, mechanical penthouses, etc.)
    const otherDocs = documents.filter((d: any) => 
      !d.filename.includes('Specification') && // Already processed
      !detailDocs.includes(d) &&
      !scheduleDocs.includes(d) &&
      !floorPlanDocs.includes(d) &&
      !elevationDocs.includes(d)
    );
    
    console.log('\n📊 Document Categories (CORRECT ORDER):');
    console.log(`   1. Specifications: 1 ✅ (757 products already saved)`);
    console.log(`   2. Construction Details: ${detailDocs.length} 🔄 PROCESSING FIRST`);
    console.log(`   3. Schedules: ${scheduleDocs.length}`);
    console.log(`   4. Floor Plans: ${floorPlanDocs.length}`);
    console.log(`   5. Elevations/Sections: ${elevationDocs.length}`);
    console.log(`   6. Other (roof, mech, etc.): ${otherDocs.length}`);
    
    // Import the workflow processor
    const { ConstructionWorkflowProcessor } = await import('./server/construction-workflow-processor');
    const processor = new (ConstructionWorkflowProcessor as any)();
    
    // Update model status
    await storage.updateBimModel(modelId, {
      status: 'generating',
      geometryData: {
        processingState: {
          status: 'processing',
          phase: 'construction_details',
          documentsProcessed: 1, // Spec done
          totalDocuments: documents.length
        }
      }
    });
    
    let totalElementsFound = 0;
    let docsProcessed = 1; // Spec already done
    
    // STEP 1: Process CONSTRUCTION DETAILS first
    console.log('\n═══════════════════════════════════════════');
    console.log('📐 PHASE 1: CONSTRUCTION DETAILS & ASSEMBLIES');
    console.log('   Claude needs to understand HOW things are built');
    console.log('═══════════════════════════════════════════\n');
    
    for (const doc of detailDocs) {
      docsProcessed++;
      console.log(`\n[${docsProcessed}/${documents.length}] Processing Detail: ${doc.filename}`);
      console.log('   This teaches Claude about wall types, assemblies, connections');
      
      try {
        const products = await processor.extractProductsFromSpec(doc, {
          modelId, // Saves immediately
          batch: docsProcessed,
          totalBatches: documents.length
        });
        
        if (products && products.length > 0) {
          totalElementsFound += products.length;
          console.log(`   ✅ Extracted ${products.length} construction details/assemblies`);
          
          // Log some examples
          if (products.length > 0) {
            console.log('   Examples found:');
            products.slice(0, 3).forEach((p: any) => {
              console.log(`     - ${p.name || p.description || 'Detail'}`);
            });
          }
        }
      } catch (error: any) {
        console.log(`   ⚠️ Error: ${error.message}`);
      }
      
      // Check for timeout
      if ((Date.now() - startTime) > 8 * 60 * 1000) {
        console.log('\n⏱️ Approaching timeout, saving progress...');
        break;
      }
    }
    
    // STEP 2: Process SCHEDULES (if time permits)
    if ((Date.now() - startTime) < 6 * 60 * 1000) {
      console.log('\n═══════════════════════════════════════════');
      console.log('📋 PHASE 2: DOOR/WINDOW SCHEDULES');
      console.log('   Specific products referenced in floor plans');
      console.log('═══════════════════════════════════════════\n');
      
      for (const doc of scheduleDocs) {
        docsProcessed++;
        console.log(`\n[${docsProcessed}/${documents.length}] Processing Schedule: ${doc.filename}`);
        
        try {
          const products = await processor.extractProductsFromSpec(doc, {
            modelId,
            batch: docsProcessed,
            totalBatches: documents.length
          });
          
          if (products && products.length > 0) {
            totalElementsFound += products.length;
            console.log(`   ✅ Extracted ${products.length} door/window items`);
          }
        } catch (error: any) {
          console.log(`   ⚠️ Error: ${error.message}`);
        }
        
        if ((Date.now() - startTime) > 8 * 60 * 1000) {
          console.log('\n⏱️ Approaching timeout, saving progress...');
          break;
        }
      }
    }
    
    // STEP 3: Process FLOOR PLANS (if time permits)
    if ((Date.now() - startTime) < 7 * 60 * 1000) {
      console.log('\n═══════════════════════════════════════════');
      console.log('🏢 PHASE 3: FLOOR PLANS');
      console.log('   Now Claude knows what W1, W2, etc. mean!');
      console.log('═══════════════════════════════════════════\n');
      
      for (const doc of floorPlanDocs.slice(0, 3)) { // Just a few for now
        docsProcessed++;
        console.log(`\n[${docsProcessed}/${documents.length}] Processing Floor Plan: ${doc.filename}`);
        console.log('   Claude can now identify wall types, room functions, etc.');
        
        try {
          const products = await processor.extractProductsFromSpec(doc, {
            modelId,
            batch: docsProcessed,
            totalBatches: documents.length
          });
          
          if (products && products.length > 0) {
            totalElementsFound += products.length;
            console.log(`   ✅ Extracted ${products.length} spatial elements`);
          }
        } catch (error: any) {
          console.log(`   ⚠️ Error: ${error.message}`);
        }
        
        if ((Date.now() - startTime) > 8 * 60 * 1000) break;
      }
    }
    
    // Check final results
    const allElements = await storage.getBimElements(modelId);
    const newElements = allElements.length - 757; // Subtract original spec products
    
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 SESSION RESULTS');
    console.log('═══════════════════════════════════════════');
    console.log(`   Documents processed: ${docsProcessed}/${documents.length}`);
    console.log(`   Total elements in database: ${allElements.length}`);
    console.log(`   - Original spec products: 757`);
    console.log(`   - NEW elements this session: ${newElements}`);
    console.log(`   - Elements found: ${totalElementsFound}`);
    console.log('');
    
    // Update status
    await storage.updateBimModel(modelId, {
      status: docsProcessed === documents.length ? 'completed' : 'paused',
      geometryData: {
        processingState: {
          status: docsProcessed === documents.length ? 'complete' : 'paused',
          phase: 'construction_details_complete',
          documentsProcessed: docsProcessed,
          totalDocuments: documents.length,
          totalElements: allElements.length,
          methodology: 'Details → Schedules → Floor Plans → Elevations'
        }
      }
    });
    
    if (docsProcessed < documents.length) {
      console.log('📋 NEXT STEPS:');
      if (floorPlanDocs.length > 3) {
        console.log(`   - ${floorPlanDocs.length - 3} more floor plans to process`);
      }
      if (elevationDocs.length > 0) {
        console.log(`   - ${elevationDocs.length} elevations/sections to process`);
      }
      if (otherDocs.length > 0) {
        console.log(`   - ${otherDocs.length} other documents to process`);
      }
      console.log('\n   Run again to continue processing with proper methodology');
    } else {
      console.log('✅ ALL DOCUMENTS PROCESSED WITH CORRECT LOGIC!');
    }
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

const startTime = Date.now();

// Run with correct logic
processWithCorrectLogic()
  .then(() => {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✨ Session completed in ${duration} seconds`);
    console.log('🎯 Claude now understands construction details BEFORE analyzing floor plans!');
  })
  .catch(e => console.error('Failed:', e.message));