# Devora - Installation Guide

## Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher
- **Git** (optional, for cloning)
- **Port 3000** available

---

## Step 1: Clone or Download

```bash
git clone https://github.com/your-repo/devora.git
cd devora
```

Or download and extract the zip file.

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Express.js (API server)
- TypeScript + tsx (development)
- PostgreSQL, Redis clients
- YAML parser, Zod validation
- 249+ npm packages

**Expected output:**
```
added 249 packages in 30s
```

---

## Step 3: Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# API Configuration
PORT=3000
NODE_ENV=development

# API Key (change in production!)
API_KEY=agency-dev-key-change-in-production

# PostgreSQL (optional - works without for demo)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=devora

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM Providers (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Step 4: Start the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

**Expected output:**
```
🚀 Devora running on port 3000
📡 Health check: http://localhost:3000/health
🔧 API endpoints: http://localhost:3000/api
```

---

## Step 5: Verify Installation

### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-13T...",
  "version": "1.0.0"
}
```

### Test API Endpoint
```bash
curl -H "Authorization: Bearer agency-dev-key" http://localhost:3000/api
```

### Test Agent List
```bash
curl -H "Authorization: Bearer agency-dev-key" http://localhost:3000/api/agent
```

---

## Step 6: Open Dashboard

1. Open `dashboard/index.html` in your browser
2. The dashboard connects to `http://localhost:3000`
3. You'll see "Connected to Devora" in the status bar

---

## Optional: Docker Deployment

### Using Docker Compose

```bash
cd docker
docker-compose up -d
```

**Services:**
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Ollama: `localhost:11434`

### Manual Docker

```bash
docker build -t devora .
docker run -p 3000:3000 -v $(pwd):/app devora
```

---

## Optional: Connect to Ollama (Local Models)

1. Install Ollama: https://ollama.com
2. Start Ollama: `ollama serve`
3. Pull a model: `ollama pull llama3.1`
4. Update `.env`: `OLLAMA_BASE_URL=http://localhost:11434`

---

## Troubleshooting

### Port 3000 in use
```bash
# Find process
lsof -i :3000
# Kill it
kill -9 <PID>
```

### TypeScript errors
```bash
# Use tsx directly
node ./node_modules/tsx/dist/cli.mjs src/api/server.ts
```

### Database connection failed
- Devora works without PostgreSQL in demo mode
- Set `POSTGRES_HOST=` (empty) to disable

### Dashboard not connecting
- Ensure server is running: `npm run dev`
- Check browser console for errors
- Verify CORS settings in `src/api/server.ts`

---

## Next Steps

- Explore skills: `/scaffold`, `/security-audit`, `/review`
- Try workflows: Code Review, Startup Launch
- Add more agents to `agents/` directory
- Customize dashboard in `dashboard/`

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm test` | Run tests |
| `npm run lint` | Lint code |
| `npm run typecheck` | TypeScript check |

**Default API Key:** `agency-dev-key-change-in-production`

**API Base URL:** `http://localhost:3000`