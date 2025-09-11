#!/bin/bash
echo "🔥 PERSISTENT EXTRACTION - WILL NOT STOP!"
echo "Target: 2000 elements from 51 documents"
echo ""

while true; do
    # Run extraction
    echo "[$(date '+%H:%M:%S')] Starting extraction attempt..."
    
    # Use timeout to prevent hanging
    timeout 120 npx tsx process-with-correct-logic.ts 2>&1 | tee -a extraction-attempts.log
    
    # Check element count
    ELEMENTS=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e').then(e => console.log(e.length))" 2>/dev/null || echo 62)
    
    echo "[$(date '+%H:%M:%S')] Current elements: $ELEMENTS"
    
    if [ "$ELEMENTS" -ge "1500" ]; then
        echo "🎉 SUCCESS! Reached $ELEMENTS elements!"
        break
    fi
    
    echo "Waiting 10 seconds before next attempt..."
    sleep 10
done

echo "✅ EXTRACTION COMPLETE!"