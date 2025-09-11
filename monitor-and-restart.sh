#!/bin/bash
# Monitor and auto-restart extraction

MODEL_ID="b6339126-4185-4dfd-a6fd-ac9c184d0c5e"

while true; do
    # Check element count  
    ELEMENTS=$(npx tsx -e "import {storage} from './server/storage.js'; storage.getBimElements('$MODEL_ID').then(e => console.log(e.length)).catch(() => console.log(0))" 2>/dev/null || echo 0)
    
    # Check if extraction is running
    if ! pgrep -f "process-with-correct-logic" > /dev/null; then
        echo "[$(date '+%H:%M:%S')] ⚠️ Extraction NOT running - RESTARTING..."
        npx tsx process-with-correct-logic.ts >> extraction.log 2>&1 &
        echo "[$(date '+%H:%M:%S')] ✅ Restarted with PID: $!"
    else
        PID=$(pgrep -f "process-with-correct-logic" | head -1)
        echo "[$(date '+%H:%M:%S')] ✅ Running (PID: $PID) | Elements: $ELEMENTS/~2000"
    fi
    
    # Check if we've reached target
    if [ "$ELEMENTS" -ge "1500" ]; then
        echo "[$(date '+%H:%M:%S')] 🎉 TARGET REACHED! $ELEMENTS elements extracted!"
        break
    fi
    
    sleep 30
done