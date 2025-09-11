#!/bin/bash

# COMPLETE AUTOMATED PROCESSING SCRIPT
# Processes all 51 documents with spatial data extraction

echo "🚀 STARTING COMPLETE AUTOMATED PROCESSING"
echo "==========================================="
echo "This will process ALL 51 documents including:"
echo "  ✓ 757+ specification items"
echo "  ✓ Construction details with assemblies" 
echo "  ✓ Door/window schedules (D101, D201, D301...)"
echo "  ✓ Floor plans with room data"
echo "  ✓ M&E equipment locations"
echo "  ✓ Exterior vs Interior classification"
echo "  ✓ Wall types and coordinates"
echo "==========================================="

# Clear any old processing state
rm -f /tmp/processed_docs_*.json 2>/dev/null

# Run the processing continuously
while true; do
  echo "Processing documents..."
  timeout 110 npx tsx process-with-correct-logic.ts 2>&1
  
  # Check if we have enough elements
  ELEMENT_COUNT=$(npx tsx -e "
    const { storage } = require('./server/storage');
    storage.getBimElements('b6339126-4185-4dfd-a6fd-ac9c184d0c5e')
      .then(elements => console.log(elements.length))
      .catch(() => console.log(0));
  " 2>/dev/null)
  
  echo "Current elements: $ELEMENT_COUNT"
  
  if [ "$ELEMENT_COUNT" -gt "2000" ]; then
    echo "✅ Processing complete! Extracted $ELEMENT_COUNT elements"
    break
  fi
  
  # Small pause before next batch
  sleep 2
done

echo "==========================================="
echo "✅ AUTOMATED PROCESSING COMPLETE"
echo "==========================================="