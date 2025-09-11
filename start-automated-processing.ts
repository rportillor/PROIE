/**
 * START AUTOMATED PROCESSING
 * This script starts the fully automated background processing
 * It will process all 51 documents without manual intervention
 */

import { BackgroundProcessorService } from "./server/services/background-processor";

const PROJECT_ID = 'c7ec2523-8631-4181-8c6e-f705861654d7';
const MODEL_ID = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';

async function startAutomatedProcessing() {
  console.log('🤖 STARTING FULLY AUTOMATED PROCESSING');
  console.log('================================================');
  console.log('This will process all 51 documents automatically');
  console.log('No manual intervention required!');
  console.log('The system will:');
  console.log('  ✓ Process documents in batches');
  console.log('  ✓ Save progress automatically');
  console.log('  ✓ Resume from last position if interrupted');
  console.log('  ✓ Extract floor-specific elements (D101, D201, D301, etc.)');
  console.log('  ✓ Cross-reference schedules with floor plans');
  console.log('================================================\n');
  
  const processor = BackgroundProcessorService.getInstance();
  
  try {
    // Start the automated background processing
    await processor.startProcessing(PROJECT_ID, MODEL_ID);
    
    console.log('✅ Background processor started successfully!');
    console.log('   Processing will continue automatically in the background');
    console.log('   Check the logs for progress updates');
    
    // Keep the process running
    setInterval(() => {
      // Keep alive - the background processor handles everything
    }, 60000);
    
  } catch (error) {
    console.error('❌ Failed to start automated processing:', error);
    process.exit(1);
  }
}

// Start the automated processing
startAutomatedProcessing();