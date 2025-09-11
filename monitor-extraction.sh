#!/bin/bash
while true; do
    echo "[$(date)] Checking extraction status..."
    
    # Check if process is running
    if ! pgrep -f "process-with-correct-logic.ts" > /dev/null; then
        echo "[$(date)] Process not running, starting it..."
        npx tsx process-with-correct-logic.ts 2>&1 &
        echo "[$(date)] Started with PID: $!"
    fi
    
    # Check database progress
    ELEMENTS=$(npx tsx -e "
        import { storage } from './server/storage.js';
        const elements = await storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e');
        console.log(elements.length);
    " 2>/dev/null || echo "0")
    
    echo "[$(date)] Elements in database: $ELEMENTS"
    
    if [ "$ELEMENTS" -ge "1500" ]; then
        echo "[$(date)] Target reached! $ELEMENTS elements extracted"
        break
    fi
    
    sleep 30
done
