# 🤖 Devora - Autonomous AI Software Orchestra

A comprehensive AI agency framework for orchestrating multi-agent software development.

## 🎯 What Is This?

Devora is a production-ready AI agency system that combines:
- **Workflow Commands** - gstack-style skills for development workflows
- **Specialist Agents** - 100+ expert roles across engineering, marketing, sales, product, design, security
- **DAG Orchestration** - Multi-agent execution with parallel processing and variable passing
- **Browser Automation** - Web automation for testing and interactions
- **Session Management** - Persistent conversations and context
- **Scaffold Engine** - Full app generation from prompts (smol-ai pattern)
- **Security Suite** - AI-powered pentesting with 300+ model support (CAI pattern)
- **Design System** - UI/UX resources from 65k+ curated design assets

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Server (Express)                   │
│                    http://localhost:3000                    │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Orchestrator │    │   LLM Manager │    │   Session     │
│   (DAG Exec)  │    │  (Multi-LLM)   │    │   Manager     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Agent System                       │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Engineer │ Marketing │  Sales   │  Product  │   Design     │
│  +15     │  +20     │  +10     │   +5     │    +5        │
├──────────┴──────────┴──────────┴──────────┴──────────────┤
│                    Specialized (+40)                         │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **PostgreSQL 14+** - Required (see setup below)
- **Node.js 20+**
- **Redis** (optional, for caching)

### Setup PostgreSQL

**Option A: Docker (Recommended)**
```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

**Option B: Local PostgreSQL**
1. Download from https://www.postgresql.org/download/
2. Create a dedicated user with a strong password.
3. Create the database named in `DATABASE_URL`

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Generate a secret with: openssl rand -hex 32
# Put it in API_KEY and set a strong POSTGRES_PASSWORD before starting
```

### 2. Start the Server
```bash
npm run dev
```

### 3. Use the API

```bash
# Health check
curl http://localhost:3000/health

# List agents
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/agent

# Run workflow
curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/workflow/run \
  -d '{"workflow": "code-review", "inputs": {"repo_url": "https://github.com/..."}}'
```

## 🎨 Workflow Skills (gstack-style)

Use these commands in Claude Code:

| Skill | Purpose |
|-------|---------|
| `/office-hours` | Product interrogation (6 questions) |
| `/plan-ceo-review` | Strategic 10-section review |
| `/plan-eng-review` | Architecture lock with diagrams |
| `/design-review` | UX audit with fixes |
| `/review` | Code review (auto-fix + flag) |
| `/qa` | Browser testing with bug fixes |
| `/ship` | Release to production |
| `/investigate` | Root cause debugging |
| `/retro` | Team retrospectives |
| `/browser-automation` | Web automation tasks |
| `/scaffold` | Full app generation from prompt |
| `/security-audit` | AI-powered pentesting (CAI pattern) |

## 👥 Agent Specializations

### Engineering Division
- Frontend Developer, Backend Architect
- DevOps Engineer, Security Engineer
- ML Engineer, Data Engineer
- QA Expert, Database Optimizer
- Algorithms Engineer, API Integrator
- Mobile Developer, Embedded Engineer

### Marketing Division
- Growth Hacker, SEO Specialist
- Content Creator, Social Media Strategist
- Twitter Engager, LinkedIn Creator
- China Market Specialist (Douyin, Xiaohongshu)

### Sales Division
- Outbound Strategist, Discovery Coach
- Deal Strategist, Sales Engineer
- Proposal Strategist, Pipeline Analyst

### Product Division
- Product Manager, Sprint Planner
- Trend Researcher, Feedback Synthesizer

### Design Division
- UI Designer, UX Researcher
- Brand Guardian, Visual Storyteller

### Security Division (CAI Patterns)
- Penetration Tester, Reconnaissance Agent
- Vulnerability Hunter, Security Architect
- Prompt Injection Specialist, Red Team Lead

### Specialized
- Automation Engineer, DevRel
- Technical Writer, Data Analyst

## 🔄 Multi-Agent Workflows

### Code Review Pipeline
```yaml
name: Code Review Pipeline
steps:
  - id: security
    role: engineering/security-engineer
    task: "Scan for vulnerabilities..."
  - id: quality
    role: engineering/frontend-developer
    task: "Review code quality..."
  - id: summary
    role: operations/incident-commander
    task: "Compile findings..."
```

### Startup Launch
```yaml
name: Startup Launch
steps:
  - id: market
    role: marketing/growth-hacker
  - id: product
    role: product/product-manager
  - id: tech
    role: engineering/software-architect
  - id: gtm
    role: marketing/growth-hacker
  - id: finance
    role: sales/deal-strategist
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api` | GET | API info |
| `/api/agent` | GET | List agents |
| `/api/agent/:id` | GET | Get agent details |
| `/api/agent/:id/execute` | POST | Execute agent |
| `/api/workflow` | GET | List workflows |
| `/api/workflow/run` | POST | Run workflow |
| `/api/sessions` | GET | List sessions |
| `/api/apikeys` | POST | Create API key |

## 🐳 Docker Deployment

```bash
cd docker
docker-compose up -d
```

Services:
- **API**: Port 3000
- **PostgreSQL**, **Redis**, and **Ollama** are internal to the Compose network by default

## 🔐 Authentication

Devora has no built-in default API key. Configure a unique `API_KEY` (at least 32 characters) before running in production. The environment key is a bootstrap administrator credential; keep it out of source control and rotate it if exposed. Set `CORS_ORIGIN` to a comma-separated allowlist of browser origins. Database API keys are stored as SHA-256 hashes, support expiry/revocation, and are returned only once when created via `/api/apikeys`.

The Compose stack binds the API to localhost by default and keeps PostgreSQL, Redis, and Ollama internal to the Compose network. Set strong database credentials in your local `.env` file.

## Workflow orchestration V2

Workflow steps now support bounded parallel execution (`concurrency`, default 3; maximum 16), dependency validation, retries (`retries`, default 1 retry), and per-step timeouts (`timeout_ms`, default 120000; maximum 600000). Independent steps may run together; a dependent step starts only after all its dependencies complete successfully. Failed dependencies are skipped, cycles and unknown dependencies are reported, and cancellation propagates to supported model HTTP requests.

A running workflow can be cancelled with `POST /api/workflow/runs/:runId/cancel`. Cancellation requests are persisted in PostgreSQL and polled by the owning worker, so a request sent to another API instance can cancel the run as long as all instances use the same database. Same-process cancellation is immediate. Inspect persisted run and step state with `GET /api/workflow/runs/:runId`.

Per-step checkpoints (status, attempt, output/error, timestamps, and worktree path) are stored in `workflow_run_steps`. Apply `src/db/schema.sql` to a new database, or run `src/db/migrations/002_workflow_checkpoints.sql` against an existing database before deploying this version.

To provide an isolated workspace to a workflow, pass `repositoryPath` and optionally `baseRef` to `POST /api/workflow/run`. Configure `DEVORA_REPOSITORIES_DIR` as an allow-listed parent directory and optionally `DEVORA_WORKTREE_DIR` as the worktree root. Each step gets a detached worktree and its path is included in the agent context and checkpoint. Remote URLs and paths outside the allow-list are rejected. Worktrees are deliberately retained after a run so generated changes are not discarded; remove them after reviewing/committing the result. Important: the current agent runtime is LLM-prompt based and does not yet expose a shell/file-edit tool API, so providing a worktree gives agents a safe workspace reference but does not itself execute code edits.

## 📁 Project Structure

```
devora/
├── src/
│   ├── api/           # Express server
│   ├── orchestrator/  # Multi-agent execution
│   ├── memory/        # Session management
│   ├── db/            # PostgreSQL client
│   └── streaming/     # SSE streaming
├── agents/            # Agent definitions
│   ├── engineering/
│   ├── marketing/
│   ├── sales/
│   ├── product/
│   └── design/
├── skills/            # Workflow skills
├── workflows/         # Workflow templates
├── dashboard/         # ClawX-style macOS dashboard
└── docker/            # Docker configs
```

## 📝 License

MIT