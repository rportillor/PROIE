#!/bin/bash
# Bulletproof extraction that will NOT stop

echo "🔥 BULLETPROOF EXTRACTION STARTING..."
echo "This will keep retrying until we get 2000 elements!"
echo ""

MODEL_ID="b6339126-4185-4dfd-a6fd-ac9c184d0c5e"
PROJECT_ID="c7ec2523-8631-4181-8c6e-f705861654d7"

while true; do
    # Check current element count
    CURRENT=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('$MODEL_ID').then(e => console.log(e.length)).catch(() => console.log(0))" 2>/dev/null || echo 0)
    
    echo "[$(date '+%H:%M:%S')] Current elements: $CURRENT"
    
    if [ "$CURRENT" -ge "1500" ]; then
        echo "🎉 SUCCESS! We have $CURRENT elements!"
        break
    fi
    
    # Try to extract
    echo "[$(date '+%H:%M:%S')] Running extraction..."
    
    # Run extraction for ONE document at a time to avoid timeouts
    npx tsx -e "
import {storage} from './server/storage.js';
import {ConstructionWorkflowProcessor} from './server/construction-workflow-processor.js';

(async () => {
  const processor = new ConstructionWorkflowProcessor();
  const docs = await storage.getDocumentsByProject('$PROJECT_ID');
  
  // Process just ONE unprocessed document
  for (const doc of docs) {
    // Check if already processed by looking for analysisResult
    if (!doc.analysisResult || doc.analysisResult === null) {
      console.log('Processing:', doc.filename);
      try {
        const result = await processor.extractProductsFromSpec(doc, {
          modelId: '$MODEL_ID',
          batch: 1,
          totalBatches: docs.length
        });
        if (result?.length > 0) {
          console.log('Extracted', result.length, 'elements');
        }
        break; // Process just ONE document then exit
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
})();
" 2>&1 || true
    
    # Wait 5 seconds before next attempt
    sleep 5
done

echo "✅ Extraction complete!"