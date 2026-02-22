#!/bin/bash

echo "Updating GitHub issues for batch 3..."

# Issue #13 - Input Validation
gh issue comment 13 --body "## ✅ Fixed in PR #47

**Branch:** \`fix/security-and-quality-batch-3\`
**Commit:** \`982fc36\`

### Changes Made:
- Installed Joi validation library
- Created centralized validation schemas (\`src/api/middleware/validation.js\`)
- Created validation middleware factory (\`src/api/middleware/validate.js\`)
- Applied validation to critical routes:
  - Auth: register, login
  - Contracts: create, update
  - Users: profile, wallet address, sync subscription
  - Onboarding: start

### Validation Rules:
- Email addresses (RFC 5322 compliant)
- Ethereum addresses (0x + 40 hex characters)
- UUIDs (v4 format)
- Chain names (ethereum, lisk, starknet only)
- String lengths (min/max)
- Password strength (min 8 characters)

### Security Benefits:
- Prevents SQL/NoSQL injection
- Prevents XSS attacks
- Strips unknown fields
- Detailed error messages for debugging
- Type coercion and sanitization

### Testing:
\`\`\`bash
# Test invalid email
curl -X POST http://localhost:5000/api/auth/register \\
  -H \"Content-Type: application/json\" \\
  -d '{\"email\":\"invalid\",\"password\":\"test123\"}'

# Test invalid Ethereum address
curl -X POST http://localhost:5000/api/users/wallet-address \\
  -H \"Authorization: Bearer TOKEN\" \\
  -d '{\"walletAddress\":\"0xinvalid\"}'
\`\`\`

### Impact:
API is now protected from malformed and malicious input." || echo "Failed #13"

# Issue #22 - Error Handling
gh issue comment 22 --body "## ✅ Fixed in PR #47

**Branch:** \`fix/security-and-quality-batch-3\`
**Commit:** \`dc157c2\`

### Changes Made:
- Created custom error classes (\`src/api/middleware/errors.js\`):
  - \`AppError\` (base class)
  - \`ValidationError\` (400)
  - \`AuthenticationError\` (401)
  - \`AuthorizationError\` (403)
  - \`NotFoundError\` (404)
  - \`ConflictError\` (409)
  - \`RateLimitError\` (429)
  - \`ExternalServiceError\` (502)
- Enhanced error handler middleware
- Added structured error logging with request context
- Created \`asyncHandler\` wrapper to eliminate try-catch boilerplate
- Consistent error response format across all endpoints

### Error Response Format:
\`\`\`json
{
  \"error\": \"ValidationError\",
  \"message\": \"Invalid input data\",
  \"details\": [
    {\"field\": \"email\", \"message\": \"Invalid email format\"}
  ]
}
\`\`\`

### Usage Example:
\`\`\`javascript
import { NotFoundError, asyncHandler } from '../middleware/errors.js';

router.get('/:id', asyncHandler(async (req, res) => {
  const item = await findById(req.params.id);
  if (!item) throw new NotFoundError('Item');
  res.json(item);
}));
\`\`\`

### Benefits:
- Consistent error format
- Better error categorization
- Structured logging
- No internal error exposure in production
- Easier debugging

### Impact:
Standardized error handling makes the API more predictable and easier to debug." || echo "Failed #22"

echo ""
echo "✅ Batch 3 issue updates complete!"
