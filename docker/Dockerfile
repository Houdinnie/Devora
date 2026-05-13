# Autonomous AI Agency - Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
COPY agents ./agents
COPY workflows ./workflows
COPY skills ./skills
COPY llm-config ./llm-config

RUN npx tsc

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

RUN groupadd -r agency && useradd -m -r -g agency agency
USER agency

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/api/server.js"]