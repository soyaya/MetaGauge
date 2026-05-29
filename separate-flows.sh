#!/bin/bash

# MetaGauge Backend/Frontend Separation Script

echo "🔄 Separating Backend and Frontend..."

# Create separate directories
mkdir -p ../metagauge-backend
mkdir -p ../metagauge-frontend

echo "📦 Moving Backend files..."
# Copy backend files
cp -r src/ ../metagauge-backend/
cp -r data/ ../metagauge-backend/
cp -r reports/ ../metagauge-backend/
cp -r scripts/ ../metagauge-backend/
cp -r tests/ ../metagauge-backend/
cp -r docs/ ../metagauge-backend/
cp -r sdk/ ../metagauge-backend/
cp package.json ../metagauge-backend/
cp package-lock.json ../metagauge-backend/
cp .env ../metagauge-backend/
cp nodemon.json ../metagauge-backend/
cp *.md ../metagauge-backend/
cp *.js ../metagauge-backend/

echo "🎨 Moving Frontend files..."
# Copy frontend files
cp -r frontend/* ../metagauge-frontend/

echo "📝 Creating separate configs..."

# Backend package.json
cat > ../metagauge-backend/package.json << 'EOF'
{
  "name": "metagauge-backend",
  "version": "1.0.0",
  "description": "MetaGauge Backend API - Multi-Chain Smart Contract Analytics",
  "main": "src/api/server.js",
  "type": "module",
  "scripts": {
    "start": "NODE_ENV=production node src/api/server.js",
    "dev": "nodemon",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --config=tests/setup/jest.config.js"
  },
  "keywords": ["blockchain", "analytics", "ethereum", "starknet", "api"],
  "author": "MetaGauge Team",
  "license": "MIT"
}
EOF

# Frontend package.json (already exists, just copy)
echo "✅ Frontend package.json already configured"

# Create Docker files
cat > ../metagauge-backend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
EOF

cat > ../metagauge-frontend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF

# Create docker-compose for both
cat > ../docker-compose.yml << 'EOF'
version: '3.8'
services:
  backend:
    build: ./metagauge-backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./metagauge-backend/.env:/app/.env
  
  frontend:
    build: ./metagauge-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5000
    depends_on:
      - backend
EOF

echo "🎉 Separation complete!"
echo ""
echo "📁 New Structure:"
echo "├── metagauge-backend/     # Node.js API (Port 5000)"
echo "├── metagauge-frontend/    # Next.js App (Port 3000)"
echo "└── docker-compose.yml     # Deploy both together"
echo ""
echo "🚀 To run separately:"
echo "Backend:  cd ../metagauge-backend && npm start"
echo "Frontend: cd ../metagauge-frontend && npm run dev"
echo ""
echo "🐳 To run with Docker:"
echo "docker-compose up"
