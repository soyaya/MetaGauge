#!/bin/bash
# Create GitHub labels for MetaGauge repo

REPO="${1:-soyaya/MetaGauge}"

echo "Creating labels for repo: $REPO"

gh label create "bug" --color "d73a4a" --description "Something isn't working" --repo "$REPO" --force
gh label create "critical" --color "b60205" --description "Critical priority" --repo "$REPO" --force
gh label create "high-priority" --color "d93f0b" --description "High priority" --repo "$REPO" --force
gh label create "backend" --color "0e8a16" --description "Backend related" --repo "$REPO" --force
gh label create "frontend" --color "1d76db" --description "Frontend related" --repo "$REPO" --force
gh label create "feature" --color "a2eeef" --description "New feature" --repo "$REPO" --force
gh label create "enhancement" --color "84b6eb" --description "Enhancement to existing feature" --repo "$REPO" --force
gh label create "good-first-issue" --color "7057ff" --description "Good for newcomers" --repo "$REPO" --force
gh label create "security" --color "ee0701" --description "Security related" --repo "$REPO" --force
gh label create "performance" --color "fbca04" --description "Performance improvement" --repo "$REPO" --force
gh label create "testing" --color "c5def5" --description "Testing related" --repo "$REPO" --force
gh label create "documentation" --color "0075ca" --description "Documentation" --repo "$REPO" --force
gh label create "infrastructure" --color "5319e7" --description "Infrastructure/DevOps" --repo "$REPO" --force
gh label create "database" --color "d4c5f9" --description "Database related" --repo "$REPO" --force
gh label create "blockchain" --color "006b75" --description "Blockchain integration" --repo "$REPO" --force
gh label create "multi-chain" --color "0e8a16" --description "Multi-chain support" --repo "$REPO" --force
gh label create "payment" --color "fbca04" --description "Payment system" --repo "$REPO" --force
gh label create "subscription" --color "d876e3" --description "Subscription system" --repo "$REPO" --force
gh label create "ai" --color "ff6ec7" --description "AI/ML related" --repo "$REPO" --force
gh label create "ui" --color "1d76db" --description "UI/UX" --repo "$REPO" --force
gh label create "data-integrity" --color "b60205" --description "Data integrity issue" --repo "$REPO" --force
gh label create "refactoring" --color "fbca04" --description "Code refactoring" --repo "$REPO" --force
gh label create "code-quality" --color "c5def5" --description "Code quality improvement" --repo "$REPO" --force
gh label create "tooling" --color "0e8a16" --description "Development tooling" --repo "$REPO" --force
gh label create "configuration" --color "d4c5f9" --description "Configuration" --repo "$REPO" --force
gh label create "routing" --color "1d76db" --description "Routing" --repo "$REPO" --force
gh label create "monitoring" --color "5319e7" --description "Monitoring/Observability" --repo "$REPO" --force
gh label create "migration" --color "d876e3" --description "Migration task" --repo "$REPO" --force
gh label create "internationalization" --color "0075ca" --description "i18n/l10n" --repo "$REPO" --force
gh label create "architecture" --color "5319e7" --description "Architecture" --repo "$REPO" --force
gh label create "quality" --color "c5def5" --description "Quality assurance" --repo "$REPO" --force
gh label create "advanced" --color "b60205" --description "Advanced difficulty" --repo "$REPO" --force
gh label create "optimization" --color "fbca04" --description "Optimization" --repo "$REPO" --force

echo ""
echo "✅ All labels created successfully!"
