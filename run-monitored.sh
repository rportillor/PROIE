#!/bin/bash

echo "🚀 STARTING MONITORED EXTRACTION PROCESS"
echo "   This will run until all 51 documents are processed"
echo "   Auto-restarting if process stops"
echo "   Logging to: extraction-monitor.log"
echo ""

# Function to run extraction
run_extraction() {
  echo "[$(date)] Starting extraction process..." >> extraction-monitor.log
  npx tsx process-with-correct-logic.ts 2>&1 | tee -a extraction-monitor.log
  return ${PIPESTATUS[0]}
}

# Monitor loop
while true; do
  echo "[$(date)] Checking extraction status..." >> extraction-monitor.log
  
  # Check how many documents have been processed
  PROCESSED=$(npx tsx -e "
    import { storage } from './server/storage.js';
    const elements = await storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e');
    console.log(elements.length);
  " 2>/dev/null)
  
  echo "[$(date)] Elements in database: $PROCESSED" >> extraction-monitor.log
  
  # If we have less than 1500 elements, keep processing
  if [ "$PROCESSED" -lt "1500" ]; then
    echo "[$(date)] Running extraction (have $PROCESSED elements, need ~2000)..." >> extraction-monitor.log
    run_extraction
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 124 ]; then
      echo "[$(date)] Process timed out, restarting..." >> extraction-monitor.log
    elif [ $EXIT_CODE -ne 0 ]; then
      echo "[$(date)] Process failed with code $EXIT_CODE, restarting in 10s..." >> extraction-monitor.log
      sleep 10
    fi
  else
    echo "[$(date)] ✅ Extraction complete! $PROCESSED elements found" >> extraction-monitor.log
    break
  fi
  
  # Wait before next check
  sleep 5
done

echo "✅ EXTRACTION COMPLETE" >> extraction-monitor.log
echo "   Check extraction-monitor.log for details"