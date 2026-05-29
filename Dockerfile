FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY data/ ./data/

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "src/api/server.js"]
