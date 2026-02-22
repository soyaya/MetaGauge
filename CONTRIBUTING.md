# Contributing to MetaGauge

Thank you for your interest in contributing to MetaGauge! This guide will help you get started.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- A code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/MetaGauge.git
cd MetaGauge
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/soyaya/MetaGauge.git
```

## 🔧 Development Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

## 📝 Making Changes

### 1. Create a Branch

```bash
git checkout -b fix/issue-description
# or
git checkout -b feature/feature-name
```

Branch naming:
- `fix/` - Bug fixes
- `feature/` - New features
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Adding tests

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 3. Commit Your Changes

```bash
git add .
git commit -m "Fix #123: Brief description of changes"
```

Commit message format:
- Start with `Fix #123:` or `Feature:` or `Docs:`
- Use present tense ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Add detailed description if needed

### 4. Push and Create PR

```bash
git push origin your-branch-name
```

Then create a Pull Request on GitHub.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 📋 Pull Request Guidelines

### PR Title Format
- `Fix: Brief description` - Bug fixes
- `Feature: Brief description` - New features
- `Docs: Brief description` - Documentation
- `Refactor: Brief description` - Code refactoring

### PR Description Should Include
- What changes were made
- Why the changes were needed
- How to test the changes
- Screenshots (if UI changes)
- Related issue numbers

### Before Submitting
- [ ] Code follows project style
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log statements (use proper logging)
- [ ] No commented-out code

## 🎨 Code Style

We use ESLint and Prettier:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 📚 Project Structure

```
MetaGauge/
├── src/
│   ├── api/          # Express API
│   ├── services/     # Business logic
│   ├── indexer/      # Blockchain indexer
│   └── config/       # Configuration
├── frontend/
│   ├── app/          # Next.js pages
│   ├── components/   # React components
│   └── lib/          # Utilities
└── tests/            # Test suites
```

## 🐛 Reporting Bugs

Use GitHub Issues with:
- Clear title
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots if applicable

## 💡 Suggesting Features

Open a GitHub Issue with:
- Clear description
- Use case
- Proposed solution
- Alternative solutions considered

## 📖 Documentation

- Update README.md for user-facing changes
- Update API docs for endpoint changes
- Add JSDoc comments for new functions
- Update CHANGELOG.md

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## 📞 Getting Help

- GitHub Discussions for questions
- GitHub Issues for bugs
- Check existing issues before creating new ones

## 🎯 Good First Issues

Look for issues labeled `good-first-issue` - these are great for newcomers!

Thank you for contributing! 🎉
