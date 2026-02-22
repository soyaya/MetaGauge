#!/bin/bash

echo "Updating GitHub issues for batch 2..."

# Issue #36 - Wallet Address Schema
gh issue comment 36 --body "## ✅ Fixed in PR #46

**Branch:** \`fix/quick-wins-batch-2\`
**Commit:** \`fd1949e\`

### Changes Made:
- Added \`walletAddress\` field to user schema
- Created migration script (\`migrations/add-wallet-address.js\`)
- Migrated 17 existing users (13 needed migration, 4 already had field)
- Added GET /api/users/wallet-address endpoint
- Added POST /api/users/wallet-address endpoint with validation

### Migration:
\`\`\`bash
node migrations/add-wallet-address.js
\`\`\`

### Testing:
\`\`\`bash
# Get wallet address
curl -H \"Authorization: Bearer TOKEN\" http://localhost:5000/api/users/wallet-address

# Set wallet address  
curl -X POST -H \"Authorization: Bearer TOKEN\" \\
  -H \"Content-Type: application/json\" \\
  -d '{\"walletAddress\":\"0x1234...\"}' \\
  http://localhost:5000/api/users/wallet-address
\`\`\`

### Impact:
Backend can now query smart contract for subscription data using user's wallet address." || echo "Failed #36"

# Issue #23 - Code Linting
gh issue comment 23 --body "## ✅ Fixed in PR #46

**Branch:** \`fix/quick-wins-batch-2\`
**Commit:** \`bceffe5\`

### Changes Made:
- Installed ESLint and Prettier
- Created .eslintrc.json with Node.js rules
- Created .prettierrc.json with code style preferences
- Added .eslintignore and .prettierignore files
- Added npm scripts: lint, lint:fix, format, format:check
- Configured to work together via eslint-config-prettier

### Usage:
\`\`\`bash
npm run lint          # Check for linting issues
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting
\`\`\`

### Impact:
Consistent code style across the project, easier to maintain and review code." || echo "Failed #23"

# Issue #5 - Continuous Sync Cycle Limit
gh issue comment 5 --body "## ✅ Fixed in PR #46

**Branch:** \`fix/quick-wins-batch-2\`
**Commit:** \`3aba832\`

### Changes Made:
- Removed hardcoded 50 cycle limit
- Now checks user's API usage against subscription tier limit
- Imports SUBSCRIPTION_TIERS for accurate limits
- Stops when API limit reached instead of arbitrary cycle count
- Logs API usage in completion metadata

### API Limits by Tier:
- Free: 1,000 API calls/month
- Starter: 10,000 API calls/month
- Pro: 50,000 API calls/month
- Enterprise: 250,000 API calls/month

### Impact:
Continuous sync now respects subscription limits, providing fair usage across all tiers." || echo "Failed #5"

# Issue #14 - Rate Limiting
gh issue comment 14 --body "## ✅ Fixed in PR #46

**Branch:** \`fix/quick-wins-batch-2\`
**Commit:** \`e8dfaa8\`

### Changes Made:
- Created subscription-based rate limiter middleware
- General API limits per 15 minutes:
  - Free: 50 requests
  - Starter: 200 requests
  - Pro: 500 requests
  - Enterprise: 2,000 requests
- Analysis API limits per hour:
  - Free: 10 analyses
  - Starter: 50 analyses
  - Pro: 200 analyses
  - Enterprise: 1,000 analyses
- Uses user ID for authenticated, IP for unauthenticated
- Applied to all routes with stricter limits on expensive operations
- Returns tier info and upgrade URL in error messages

### Testing:
\`\`\`bash
# Test rate limiting
for i in {1..60}; do
  curl -H \"Authorization: Bearer TOKEN\" http://localhost:5000/api/users/profile
done
# Should get rate limit error after tier limit
\`\`\`

### Impact:
API is now protected from abuse with fair limits based on subscription tier." || echo "Failed #14"

echo ""
echo "✅ Batch 2 issue updates complete!"
