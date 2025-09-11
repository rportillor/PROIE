import { storage } from './server/storage.js';
import { processDocumentWithAI } from './server/services/claude-service.js';
import fs from 'fs';

async function restoreSpecifications() {
  const projectId = 'c7ec2523-8631-4181-8c6e-f705861654d7';
  const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';

  console.log('🔄 RESTORING SPECIFICATION DATA');
  console.log('   Looking for the original 757 specification elements...\n');

  // Get specifications document
  const docs = await storage.getDocuments(projectId);
  const specDoc = docs.find(d => d.filename.includes('Specification'));

  if (!specDoc) {
    console.error('❌ Specifications document not found!');
    process.exit(1);
  }

  console.log('📄 Found specifications document:', specDoc.filename);
  console.log('   Document ID:', specDoc.id);
  console.log('   This contains comprehensive material and product specifications\n');

  const filePath = `./uploads/${specDoc.id}_${specDoc.filename}`;
  const textContent = fs.readFileSync(filePath, 'utf8');

  console.log('📊 Document statistics:');
  console.log('   - Size:', (textContent.length / 1024).toFixed(1), 'KB');
  console.log('   - Characters:', textContent.length);
  console.log('');

  console.log('🧠 Sending to Claude AI for extraction...');
  console.log('   Extracting ALL specification items including:');
  console.log('   • Concrete specifications (Division 03)');
  console.log('   • Masonry specifications (Division 04)');  
  console.log('   • Steel specifications (Division 05)');
  console.log('   • Wood specifications (Division 06)');
  console.log('   • Thermal and moisture protection (Division 07)');
  console.log('   • Doors and windows (Division 08)');
  console.log('   • Finishes (Division 09)');
  console.log('   • Equipment (Divisions 10-14)');
  console.log('   • Mechanical systems (Divisions 21-23)');
  console.log('   • Electrical systems (Division 26)');
  console.log('   • Communications (Division 27)');
  console.log('   • Site work (Divisions 31-33)');
  console.log('');

  // Process in chunks to get ALL specs
  const chunkSize = 50000; // Process in 50KB chunks
  const chunks = [];
  for (let i = 0; i < textContent.length; i += chunkSize) {
    chunks.push(textContent.slice(i, i + chunkSize));
  }

  console.log('📦 Processing', chunks.length, 'chunks of specification data...\n');

  const allElements = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`   Chunk ${i + 1}/${chunks.length}...`);
    
    const result = await processDocumentWithAI({
      projectId,
      modelId,
      documentId: specDoc.id,
      textContent: chunks[i],
      documentCategory: 'specifications',
      prompt: `You are analyzing construction specifications. Extract ALL products, materials, and systems from this section.

EXTRACT EVERY ITEM found including:
- Material specifications (concrete mix designs, steel grades, wood types, etc.)
- Product specifications (door models, window types, hardware, fixtures, equipment)
- System specifications (HVAC units, electrical panels, plumbing fixtures, fire systems)
- Construction assemblies (wall types, roof systems, floor assemblies)
- Performance requirements and standards

For EACH item provide:
{
  "name": "Specific product/material name from specs",
  "element_type": "Product",
  "properties": {
    "csiCode": "CSI MasterFormat code (e.g., 03.30.00 for concrete)",
    "name": "Full descriptive name",
    "material": "Material composition if specified",
    "manufacturer": "Manufacturer if mentioned",
    "model": "Model number if provided",
    "standard": "Referenced standards (ASTM, CSA, etc.)",
    "performance": "Performance requirements",
    "location": "Where used in building"
  },
  "geometry": {
    "floor": "Applicable floor or 'All Floors'"
  }
}

BE EXHAUSTIVE - extract EVERY specification item, no matter how minor.`
    });

    allElements.push(...result.elements);
  }

  console.log('\n✅ Extraction complete!');
  console.log('   Total specification items found:', allElements.length);
  
  // Remove duplicates based on name
  const uniqueElements = Array.from(
    new Map(allElements.map(e => [e.properties?.name || e.name, e])).values()
  );
  
  console.log('   Unique items after deduplication:', uniqueElements.length);
  console.log('\n💾 Saving specification elements to database...\n');

  // Save with unique IDs
  let savedCount = 0;
  let failedCount = 0;
  
  for (const element of uniqueElements) {
    try {
      const elementToSave = {
        element_id: `SPEC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        model_id: modelId,
        element_type: element.element_type || 'Product',
        properties: element.properties || { name: element.name, csiCode: '01.00.00' },
        geometry: element.geometry || { floor: 'All Floors' }
      };
      
      const saved = await storage.saveBimElement(elementToSave);
      if (saved) {
        savedCount++;
        if (savedCount % 50 === 0) {
          console.log(`   Saved ${savedCount} elements...`);
        }
      }
    } catch (error) {
      failedCount++;
    }
  }

  console.log('\n📊 RESTORATION COMPLETE:');
  console.log('   ✅ Successfully saved:', savedCount, 'specification elements');
  if (failedCount > 0) {
    console.log('   ⚠️ Failed to save:', failedCount, 'elements');
  }

  // Verify total in database
  const allDbElements = await storage.getBimElements(modelId);
  console.log('\n🔍 DATABASE VERIFICATION:');
  console.log('   Total elements in database now:', allDbElements.length);
  console.log('   (56 construction details + ', savedCount, 'specifications)');
  
  // Show sample of what was saved
  console.log('\n📋 Sample of restored specifications:');
  const samples = uniqueElements.slice(0, 5);
  samples.forEach(el => {
    const name = el.properties?.name || el.name;
    const csi = el.properties?.csiCode || 'N/A';
    console.log(`   • ${name} (CSI: ${csi})`);
  });
}

// Run the restoration
restoreSpecifications().catch(console.error);