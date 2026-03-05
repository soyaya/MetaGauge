# Contributing to MetaGauge

## Development Setup Guide

### Prerequisites

- Node.js 18+
- npm or yarn
- MongoDB (local or Atlas)
- Git

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/soyaya/MetaGauge.git
   cd MetaGauge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Copy `.env.test` to `.env` and configure:
   ```bash
   cp .env.test .env
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

### Project Structure

```
MetaGauge/
├── src/              # Source code
│   ├── backend/      # Express.js API
│   └── frontend/     # React app
├── tests/            # Test files
├── scripts/          # Utility scripts
└── docs/            # Documentation
```

### Making Changes

1. Create a new branch
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes and commit
   ```bash
   git commit -m "Description of changes"
   ```

3. Push and create a PR
   ```bash
   git push origin feature/your-feature
   ```

### Testing

```bash
npm test
```

### Code Style

- Use ESLint for JavaScript linting
- Use Prettier for code formatting

---

*Contributions are welcome!*
