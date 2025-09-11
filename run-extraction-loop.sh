#!/bin/bash
echo "Starting continuous extraction with monitoring..."
while true; do
    echo "[$(date)] Starting extraction process..."
    npx tsx process-with-correct-logic.ts
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Process completed successfully!"
        break
    else
        echo "[$(date)] Process stopped with code $EXIT_CODE, restarting in 5 seconds..."
        sleep 5
    fi
done
