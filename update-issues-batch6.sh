#!/bin/bash
echo "Updating issues for batch 6..."

gh issue comment 18 --body "## ✅ Fixed in PR #50
**Commit:** \`9d6b5e4\`
Created CacheManager with TTL, cache middleware for GET requests." || echo "Failed #18"

gh issue comment 11 --body "## ✅ Fixed in PR #50
**Commit:** \`c219a61\`
Added resend-verification endpoint. Change password and delete account from #27." || echo "Failed #11"

gh issue comment 10 --body "## ✅ Fixed in PR #50
**Commit:** \`b089635\`
Added /api/subscription-sync/fresh to query smart contract directly." || echo "Failed #10"

gh issue comment 9 --body "## ✅ Fixed in PR #50
**Commit:** \`97a87a2\`
Enhanced dashboard with monitoring status and API usage stats." || echo "Failed #9"

gh issue comment 39 --body "## ✅ Fixed in PR #50
**Commit:** \`09ec238\`
Created CONTRIBUTING.md and DEVELOPMENT.md with complete setup guides." || echo "Failed #39"

echo "✅ Batch 6 complete!"
