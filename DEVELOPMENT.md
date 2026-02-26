# Development Guide

Complete guide for setting up MetaGauge development environment.

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **Google Gemini API Key** (optional, for AI features)

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/soyaya/MetaGauge.git
cd MetaGauge
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Environment Configuration

#### Backend (.env)

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
CONTRACT_ADDRESS=0xYourContractAddress
CONTRACT_CHAIN=lisk
CONTRACT_NAME=YourProject

# RPC Endpoints (at least one per chain)
LISK_RPC_URL1=https://lisk.drpc.org
ETHEREUM_RPC_URL1=https://ethereum-rpc.publicnode.com

# JWT Secret (REQUIRED - 32+ characters)
JWT_SECRET=your-super-secure-random-string-at-least-32-characters-long

# Optional: AI Features
GEMINI_API_KEY=your-gemini-api-key

# Server
PORT=5000
NODE_ENV=development
```

#### Frontend (frontend/.env)

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 🏃 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
npm run dev
```
Backend runs on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:3000

### Production Mode

**Backend:**
```bash
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🔍 Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## 📊 Database

Currently using file-based storage in `./data/`:
- `users.json` - User accounts
- `contracts.json` - Contract configurations
- `analyses.json` - Analysis results
- `chat_sessions.json` - Chat sessions
- `chat_messages.json` - Chat messages

### Backup

```bash
# Manual backup (Enterprise tier required)
curl -X POST http://localhost:5000/api/backup/create \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐛 Debugging

### Backend Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/src/api/server.js",
  "envFile": "${workspaceFolder}/.env"
}
```

### Frontend Debugging

```bash
cd frontend
npm run dev
```

Open Chrome DevTools or VS Code debugger.

## 📝 API Documentation

Access Swagger UI:
```
http://localhost:5000/api-docs
```

Get OpenAPI spec:
```
http://localhost:5000/api-docs.json
```

## 🔧 Common Issues

### Port Already in Use

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port
PORT=5001 npm run dev
```

### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### JWT Secret Error

Ensure JWT_SECRET in `.env` is at least 32 characters.

### RPC Connection Errors

- Check RPC URLs are correct
- Try alternative RPC providers
- Check network connectivity

## 📁 Project Structure

```
MetaGauge/
├── src/
│   ├── api/
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Express middleware
│   │   ├── database/      # Storage layer
│   │   └── docs/          # API documentation
│   ├── services/          # Business logic
│   ├── indexer/           # Blockchain indexer
│   └── config/            # Configuration
├── frontend/
│   ├── app/               # Next.js pages
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   └── public/            # Static assets
├── tests/                 # Test suites
├── data/                  # File storage
├── backups/               # Automated backups
└── reports/               # Generated reports
```

## 🌐 Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 5000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `JWT_SECRET` | **Yes** | - | JWT secret (32+ chars) |
| `CONTRACT_ADDRESS` | Yes | - | Target contract |
| `CONTRACT_CHAIN` | Yes | - | Blockchain (ethereum/lisk/starknet) |
| `GEMINI_API_KEY` | No | - | Google Gemini API key |
| `LISK_RPC_URL1` | Yes | - | Lisk RPC endpoint |
| `ETHEREUM_RPC_URL1` | No | - | Ethereum RPC endpoint |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API URL |

## 🚀 Deployment

See deployment guides:
- [Vercel](https://vercel.com/docs) for frontend
- [Railway](https://railway.app/docs) for backend
- [Render](https://render.com/docs) for backend

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Joi Validation](https://joi.dev/api/)

## 💬 Getting Help

- Check [GitHub Issues](https://github.com/soyaya/MetaGauge/issues)
- Read [CONTRIBUTING.md](CONTRIBUTING.md)
- Join [GitHub Discussions](https://github.com/soyaya/MetaGauge/discussions)

Happy coding! 🎉
