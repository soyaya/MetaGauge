#!/bin/bash
echo "Updating GitHub issues for batch 5..."

gh issue comment 21 --body "## ✅ Fixed in PR #49
**Commit:** \`1034d68\`
Removed 4 duplicate LiskRpcClient files, kept active implementation." || echo "Failed #21"

gh issue comment 20 --body "## ✅ Fixed in PR #49
**Commit:** \`2cc3c67\`
Added bundle analyzer, SWC minification, compression, tree-shaking." || echo "Failed #20"

gh issue comment 16 --body "## ✅ Fixed in PR #49
**Commit:** \`d50ec04\`
Created user journey integration test covering signup→login→profile→contracts." || echo "Failed #16"

gh issue comment 25 --body "## ✅ Fixed in PR #49
**Commit:** \`deaf16b\`
Added CSV/JSON export endpoints for analysis data." || echo "Failed #25"

gh issue comment 27 --body "## ✅ Fixed in PR #49
**Commit:** \`f2fa43c\`
Added change-password and delete-account endpoints." || echo "Failed #27"

echo "✅ Batch 5 complete!"
