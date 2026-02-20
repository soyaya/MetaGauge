#!/bin/bash

echo "🧹 Cleaning up dummy/legacy data..."

# 1. Reset data files to empty arrays
echo "📁 Resetting data files..."
echo '[]' > data/users.json
echo '[]' > data/contracts.json
echo '[]' > data/analyses.json

# 2. Remove backup files
echo "🗑️  Removing backup files..."
rm -f data/*.backup

# 3. Remove legacy marathon sync hook
echo "🗑️  Removing marathon sync hook..."
rm -f frontend/hooks/use-marathon-sync.ts

# 4. Remove test/debug files
echo "🗑️  Removing test files..."
rm -f test-*.js
rm -f fix-*.js
rm -f diagnose-*.js
rm -f verify-*.js
rm -f health-check.js
rm -f vet-all-endpoints.js
rm -f apply-fixes.sh
rm -f check-files.sh
rm -f restart-server.sh
rm -f start-minimal.sh
rm -f start-full-server.sh
rm -f run-minimal-only.sh

# 5. Remove minimal server
echo "🗑️  Removing minimal server..."
rm -f server-minimal.js
rm -f server-minimal.log

# 6. Remove log files
echo "🗑️  Removing logs..."
rm -f *.log
rm -f backend.pid
rm -f logs/*.log

# 7. Remove broken/backup service files
echo "🗑️  Removing broken service files..."
rm -f src/services/*.broken
rm -f src/services/*_backup.js
rm -f src/services/*_Original.js
rm -f src/services/*_Enhanced.js
rm -f src/services/*_Optimized.js
rm -f src/services/*_Simplified.js

# 8. Remove outdated documentation
echo "📄 Removing outdated docs..."
rm -f SYNC_FLOWS_DOCUMENTATION.md
rm -f QUICK_SYNC_*.md
rm -f MARATHON_SYNC_*.md
rm -f *_FIX*.md
rm -f *_FIXES*.md
rm -f *_COMPLETE*.md
rm -f *_STATUS*.md
rm -f *_SUMMARY*.md
rm -f *_ANALYSIS*.md
rm -f *_PLAN*.md
rm -f *_CHECKLIST*.md
rm -f *_REPORT*.md
rm -f *_VERIFICATION*.md
rm -f PHASE_*.md
rm -f REMOVAL_*.md
rm -f REMOVE_*.md
rm -f MIGRATION_*.md
rm -f POSTGRESQL_*.md
rm -f ONBOARDING_*.md
rm -f FRONTEND_*.md
rm -f BACKEND_*.md
rm -f RPC_*.md
rm -f CHAIN_*.md
rm -f ENDPOINT_*.md
rm -f CORS_*.md
rm -f TIMEOUT_*.md
rm -f CONSOLE_*.md
rm -f PROGRESS_*.md
rm -f UI_*.md
rm -f APP_*.md
rm -f CODE_*.md
rm -f DATABASE_*.md
rm -f STORAGE_*.md
rm -f HEALTH_*.md
rm -f ISSUE_*.md
rm -f METRICS_*.md
rm -f STREAMING_*.md
rm -f CONTINUOUS_*.md
rm -f IMPLEMENTATION_*.md
rm -f SMART_*.md
rm -f COMPLETE_*.md
rm -f ALL_*.md
rm -f FIX_*.md
rm -f FIXES_*.md
rm -f MINIMAL_*.md
rm -f CONTRACT_*.md
rm -f TASKS_*.md
rm -f *.txt

# 9. Remove reports directory
echo "📊 Removing reports..."
rm -rf reports/*

# 10. Keep only essential docs
echo "✅ Keeping essential docs: README.md, TROUBLESHOOTING.md"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Data files reset to empty"
echo "  ✅ Backup files removed"
echo "  ✅ Marathon sync hook removed"
echo "  ✅ Test/debug files removed"
echo "  ✅ Log files cleared"
echo "  ✅ Broken service files removed"
echo "  ✅ Outdated documentation removed"
echo "  ✅ Reports cleared"
echo ""
echo "🚀 Ready for fresh start!"
