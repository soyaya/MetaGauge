#!/bin/bash

echo "Updating GitHub issues for batch 4..."

# Issue #15 - Database Backups
gh issue comment 15 --body "## ✅ Fixed in PR #48

**Branch:** \`fix/infrastructure-batch-4\`
**Commit:** \`0d4137c\`

### Changes Made:
- Created BackupService with gzip compression
- Created BackupScheduler for automated backups
- Backup types: hourly, daily, weekly, monthly, manual
- Retention policy:
  - Hourly: 1 day
  - Daily: 7 days
  - Weekly: 30 days
  - Monthly: 365 days
- Automatic cleanup of old backups
- Admin API endpoints (Enterprise tier only)
- Integrated into server startup/shutdown

### API Endpoints:
\`\`\`bash
POST /api/backup/create   # Create manual backup
GET  /api/backup/list     # List all backups
POST /api/backup/restore  # Restore from backup
POST /api/backup/cleanup  # Cleanup old backups
\`\`\`

### Backup Schedule:
- Hourly: Every hour
- Daily: 2:00 AM
- Weekly: Sunday 3:00 AM
- Monthly: 1st of month 4:00 AM

### Testing:
\`\`\`bash
# Create manual backup
curl -X POST http://localhost:5000/api/backup/create \\
  -H \"Authorization: Bearer ENTERPRISE_TOKEN\"

# List backups
curl http://localhost:5000/api/backup/list \\
  -H \"Authorization: Bearer ENTERPRISE_TOKEN\"
\`\`\`

### Impact:
Automated backups protect against data loss with configurable retention policy." || echo "Failed #15"

# Issue #17 - API Documentation
gh issue comment 17 --body "## ✅ Fixed in PR #48

**Branch:** \`fix/infrastructure-batch-4\`
**Commit:** \`b7d960a\`

### Changes Made:
- Installed swagger-jsdoc and swagger-ui-express
- Created OpenAPI 3.0 specification
- Interactive Swagger UI at /api-docs
- JSON spec endpoint at /api-docs.json
- Documented all major schemas and endpoints
- Organized by tags (Auth, Users, Contracts, etc.)
- Includes authentication schemes and examples

### Access Documentation:
\`\`\`bash
# Interactive UI
http://localhost:5000/api-docs

# JSON spec
http://localhost:5000/api-docs.json
\`\`\`

### Features:
- Complete endpoint documentation
- Request/response examples
- Authentication requirements
- Error response formats
- Schema definitions
- Try-it-out functionality

### Impact:
Developers can now easily understand and integrate with the API." || echo "Failed #17"

echo ""
echo "✅ Batch 4 issue updates complete!"
