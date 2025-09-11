#!/bin/bash
echo "🔥 CONTINUOUS EXTRACTION MONITOR"
echo "Will restart extraction if it stops!"

while true; do
    # Check if extraction is running
    if ! pgrep -f "process-with-correct-logic" > /dev/null; then
        echo "[$(date '+%H:%M:%S')] Extraction stopped - RESTARTING..."
        npx tsx process-with-correct-logic.ts >> extraction-continuous.log 2>&1 &
        echo "[$(date '+%H:%M:%S')] Restarted with PID: $!"
    fi
    
    # Check element count
    ELEMENTS=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e').then(e => console.log(e.length))" 2>/dev/null || echo 62)
    echo "[$(date '+%H:%M:%S')] Elements: $ELEMENTS"
    
    if [ "$ELEMENTS" -ge "1500" ]; then
        echo "🎉 SUCCESS! $ELEMENTS elements extracted!"
        break
    fi
    
    sleep 30
done
