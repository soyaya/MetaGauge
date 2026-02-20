#!/bin/bash
echo "🔍 Checking for corrupted files..."
echo ""

errors=0

# Check backend files
echo "📦 Backend Files:"
for file in src/api/routes/*.js src/api/server.js src/services/OptimizedQuickScan.js src/services/SmartContractFetcher.js; do
  if [ -f "$file" ]; then
    if node --check "$file" 2>/dev/null; then
      echo "  ✅ $file"
    else
      echo "  ❌ $file - SYNTAX ERROR"
      errors=$((errors + 1))
    fi
  fi
done

echo ""
echo "📊 Summary:"
if [ $errors -eq 0 ]; then
  echo "  ✅ All files OK - No corruption detected"
else
  echo "  ❌ $errors file(s) have errors"
fi
