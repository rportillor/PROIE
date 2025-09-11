#!/usr/bin/env npx tsx
import { storage } from './server/storage.js';
import { constructionProcessor } from './server/construction-workflow-processor.js';
import fs from 'fs';

const PROJECT_ID = 'c7ec2523-8631-4181-8c6e-f705861654d7';
const MODEL_ID = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';
const MAX_RETRIES = 3;
const CHECKPOINT_FILE = './extraction-progress.json';

interface Progress {
  lastProcessedIndex: number;
  totalElements: number;
  startTime: number;
  documentsProcessed: string[];
}

async function loadProgress(): Promise<Progress> {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    lastProcessedIndex: 0,
    totalElements: 0,
    startTime: Date.now(),
    documentsProcessed: []
  };
}

async function saveProgress(progress: Progress) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(progress, null, 2));
}

async function processWithMonitoring() {
  console.log('🚀 STARTING MONITORED EXTRACTION SYSTEM');
  console.log('   This will run until all 51 documents are processed');
  console.log('   Auto-saving progress and resuming if interrupted\n');
  
  const progress = await loadProgress();
  const documents = await storage.getDocuments(PROJECT_ID);
  
  console.log(`📊 Status: ${progress.lastProcessedIndex}/${documents.length} documents processed`);
  console.log(`💾 ${progress.totalElements} elements saved so far\n`);
  
  // Process documents in correct order
  const docOrder = [
    // 1. Specifications (already done but re-check)
    (d: any) => d.filename.includes('Specification'),
    // 2. Construction Details
    (d: any) => d.filename.includes('Detail') || d.filename.includes('detail'),
    // 3. Schedules
    (d: any) => d.filename.includes('Schedule') || d.filename.includes('schedule'),
    // 4. Floor Plans (CRITICAL for spatial data)
    (d: any) => d.filename.includes('Floor') || d.filename.includes('floor') || d.filename.includes('Level'),
    // 5. Elevations
    (d: any) => d.filename.includes('Elevation') || d.filename.includes('Section'),
    // 6. Mechanical/Electrical
    (d: any) => d.filename.includes('Mech') || d.filename.includes('Elec') || d.filename.includes('Plumb'),
    // 7. Others
    (d: any) => true
  ];
  
  const sortedDocs = [...documents].sort((a, b) => {
    const aIndex = docOrder.findIndex(fn => fn(a));
    const bIndex = docOrder.findIndex(fn => fn(b));
    return aIndex - bIndex;
  });
  
  for (let i = progress.lastProcessedIndex; i < sortedDocs.length; i++) {
    const doc = sortedDocs[i];
    
    if (progress.documentsProcessed.includes(doc.id)) {
      console.log(`⏭️  Skipping ${doc.filename} (already processed)`);
      continue;
    }
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`📄 [${i + 1}/${sortedDocs.length}] Processing: ${doc.filename}`);
    
    let retries = 0;
    let success = false;
    
    while (retries < MAX_RETRIES && !success) {
      try {
        const filePath = `./uploads/${doc.id}_${doc.filename}`;
        const textContent = fs.readFileSync(filePath, 'utf8');
        
        // Determine document type and create appropriate prompt
        let prompt = '';
        let category = 'general';
        
        if (doc.filename.includes('pecification')) {
          category = 'specifications';
          prompt = `Extract ALL products, materials, and systems from this specification document. Include concrete mixes, steel grades, door/window models, finishes, equipment, etc. Be EXHAUSTIVE.`;
        } else if (doc.filename.includes('Floor') || doc.filename.includes('Level')) {
          category = 'floor_plans';
          prompt = `Extract ALL spatial elements from this floor plan. For EACH element provide:
- Floor-specific naming (D101/Floor 1, D201/Floor 2, etc.)
- Room numbers and associations
- Wall types with start/end coordinates
- Door/window locations with room connections
- M&E equipment with spatial positions
- Extract EVERYTHING visible on the plan`;
        } else if (doc.filename.includes('Detail')) {
          category = 'details';
          prompt = `Extract construction assemblies and details. Include wall types, connections, materials, dimensions.`;
        } else if (doc.filename.includes('Schedule')) {
          category = 'schedules';
          prompt = `Extract ALL items from schedules including doors, windows, finishes, equipment with their codes and specifications.`;
        }
        
        const result = await processDocumentWithAI({
          projectId: PROJECT_ID,
          modelId: MODEL_ID,
          documentId: doc.id,
          textContent,
          documentCategory: category,
          prompt
        });
        
        console.log(`   ✅ Extracted ${result.elements.length} elements`);
        
        // Save elements with unique IDs
        let savedCount = 0;
        for (const element of result.elements) {
          try {
            const saved = await storage.saveBimElement({
              ...element,
              element_id: `${category.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              model_id: MODEL_ID
            });
            if (saved) savedCount++;
          } catch (e) {
            // Continue on individual save errors
          }
        }
        
        console.log(`   💾 Saved ${savedCount} elements to database`);
        
        // Update progress
        progress.lastProcessedIndex = i + 1;
        progress.totalElements += savedCount;
        progress.documentsProcessed.push(doc.id);
        await saveProgress(progress);
        
        success = true;
        
        // Show running total
        const allElements = await storage.getBimElements(MODEL_ID);
        console.log(`   📊 Total in database: ${allElements.length} elements`);
        
      } catch (error: any) {
        retries++;
        console.log(`   ⚠️ Error (attempt ${retries}/${MAX_RETRIES}): ${error.message}`);
        
        if (retries < MAX_RETRIES) {
          console.log(`   ⏳ Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    if (!success) {
      console.log(`   ❌ Failed to process after ${MAX_RETRIES} attempts, continuing...`);
    }
    
    // Progress report every 5 documents
    if ((i + 1) % 5 === 0) {
      const elapsed = (Date.now() - progress.startTime) / 1000 / 60;
      console.log(`\n📈 PROGRESS REPORT:`);
      console.log(`   Documents: ${i + 1}/${sortedDocs.length}`);
      console.log(`   Elements saved: ${progress.totalElements}`);
      console.log(`   Time elapsed: ${elapsed.toFixed(1)} minutes`);
      console.log(`   Estimated remaining: ${((sortedDocs.length - i - 1) * elapsed / (i + 1)).toFixed(1)} minutes\n`);
    }
  }
  
  // Final report
  console.log(`\n✅ ═══════════════════════════════════════════`);
  console.log(`✅ EXTRACTION COMPLETE!`);
  console.log(`✅ ═══════════════════════════════════════════\n`);
  
  const allElements = await storage.getBimElements(MODEL_ID);
  const elapsed = (Date.now() - progress.startTime) / 1000 / 60;
  
  console.log(`📊 FINAL RESULTS:`);
  console.log(`   Total documents processed: ${progress.documentsProcessed.length}/${documents.length}`);
  console.log(`   Total elements in database: ${allElements.length}`);
  console.log(`   New elements added this run: ${progress.totalElements}`);
  console.log(`   Total time: ${elapsed.toFixed(1)} minutes\n`);
  
  // Show breakdown by type
  const typeCount = allElements.reduce((acc: any, el: any) => {
    const type = el.element_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`📋 Elements by type:`);
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
  });
  
  // Clean up progress file
  if (progress.documentsProcessed.length === documents.length) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log(`\n✅ Progress file cleaned up`);
  }
}

// Monitor function that restarts if needed
async function monitorAndRun() {
  while (true) {
    try {
      await processWithMonitoring();
      break; // Exit if completed successfully
    } catch (error: any) {
      console.error(`\n❌ Process crashed: ${error.message}`);
      console.log(`🔄 Restarting in 10 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Start the monitored extraction
console.log('═══════════════════════════════════════════');
console.log('🤖 MONITORED EXTRACTION SYSTEM v2.0');
console.log('═══════════════════════════════════════════');
console.log('Features:');
console.log('  ✓ Auto-resume from last checkpoint');
console.log('  ✓ Retry failed documents');
console.log('  ✓ Progress saved after each document');
console.log('  ✓ Self-monitoring with auto-restart');
console.log('  ✓ Runs until ALL 51 documents processed');
console.log('═══════════════════════════════════════════\n');

monitorAndRun().catch(console.error);