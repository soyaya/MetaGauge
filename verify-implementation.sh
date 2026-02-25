#!/bin/bash
echo "🔍 Verifying Function Analytics Implementation"
echo ""
echo "✅ BACKEND SERVICES:"
ls -1 src/services/Function*.js src/services/Journey*.js src/services/Cohort*.js src/services/Analytics*.js src/services/ABI*.js 2>/dev/null | sed 's/^/   ✓ /'
echo ""
echo "✅ API ROUTES:"
ls -1 src/api/routes/functions.js 2>/dev/null | sed 's/^/   ✓ /'
echo ""
echo "✅ FRONTEND COMPONENTS:"
ls -1 frontend/components/analyzer/functions*.tsx frontend/components/analyzer/*journey*.tsx frontend/components/analyzer/*cohort*.tsx 2>/dev/null | sed 's/^/   ✓ /'
echo ""
echo "✅ TESTS:"
echo "   Unit Tests:"
ls -1 tests/unit/function-analytics/*.test.js 2>/dev/null | wc -l | xargs echo "      Files:"
echo "   Property Tests:"
ls -1 tests/property/function-analytics*.test.js 2>/dev/null | wc -l | xargs echo "      Files:"
echo "   Integration Tests:"
ls -1 tests/integration/function-analytics*.test.js 2>/dev/null | wc -l | xargs echo "      Files:"
echo ""
echo "✅ DATA:"
ls -1 data/function-analytics/ 2>/dev/null | head -3 | sed 's/^/   ✓ /'
