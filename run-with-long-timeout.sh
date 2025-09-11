#!/bin/bash
echo "🚀 RUNNING EXTRACTION WITH LONG TIMEOUT..."
echo "This will give it 10 MINUTES per attempt!"
echo ""

while true; do
    CURRENT=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e').then(e => console.log(e.length))" 2>/dev/null || echo 62)
    echo "[$(date '+%H:%M:%S')] Current: $CURRENT elements"
    
    if [ "$CURRENT" -ge "1500" ]; then
        echo "SUCCESS! $CURRENT elements!"
        break
    fi
    
    echo "Running extraction with 10 minute timeout..."
    timeout 600 npx tsx process-with-correct-logic.ts 2>&1
    
    echo "Checking new count..."
    NEW=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e').then(e => console.log(e.length))" 2>/dev/null || echo 62)
    echo "Elements after run: $NEW"
    
    if [ "$NEW" -gt "$CURRENT" ]; then
        echo "✅ PROGRESS! Gained $((NEW - CURRENT)) elements!"
    fi
    
    echo "Waiting 5 seconds..."
    sleep 5
done