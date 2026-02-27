# Development Guide

This guide covers setting up your local development environment.

## 📦 Prerequisites

- Node.js 18+
- npm or yarn
- Git

## 🛠️ Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.test` to `.env` and configure:

```bash
cp .env.test .env
```

Required variables:
- `DATABASE_URL` - Your database connection
- `API_KEY` - External API key
- `NODE_ENV` - Set to `development`

### 3. Start Development Server

```bash
# Full server
npm run dev

# Minimal server (for quick testing)
npm run start:minimal
```

### 4. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/filename.test.js

# Run with coverage
npm run test:coverage
```

## 🔧 Common Commands

```bash
# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Issues
- Ensure database is running
- Check `.env` configuration
- Run migrations: `npm run migrate`

### Node Module Issues
```bash
# Clean and reinstall
rm -rf node_modules
npm install
```

## 📁 Project Structure

```
/src           - Source code
/frontend      - Frontend React app
/tests         - Test files
/scripts       - Utility scripts
/data          - Data files
```

## 🤝 Code Style

- Use ESLint for code linting
- Follow Prettier formatting
- Write meaningful commit messages

---
*Last updated: 2026-02-27*
