# Devora

A TypeScript/Express project for loading specialist agent prompts and running multi-step LLM workflows. It includes an API, a static dashboard, Markdown skills, and PostgreSQL-backed sessions and workflow checkpoints.

This is a development project, not a finished autonomous software agency. Starting the API does not mean an agent has run, a repository has been edited, or an app has been deployed.

## Current inventory

The default agent registry loads **59 agents across 14 divisions**: engineering, webdesign, SEO, operations, marketing, sales, product, HR, finance, strategy, testing, security, design, and specialized. These are Markdown prompt definitions, not 59 running processes. Other folders under `agents/` are not part of that registry.

There are **45 Markdown skills** and **6 workflow templates**:

| Workflow | API identifier |
| --- | --- |
| Code Review Pipeline | `code-review` |
| Data Analysis Pipeline | `data-analysis` |
| Feature Development Pipeline | `feature-development` |
| Fullstack App Generator | `fullstack-app` |
| Security Audit Pipeline | `security-audit` |
| Startup Launch | `startup-launch` |

Use the filename-based identifier in run requests, not the display name. Skills and templates describe tasks; their presence is not proof that browser automation, pentesting, or full app generation works end to end.

## Requirements by mode

- **API startup only:** Node.js 20+ and npm. The server starts without `DATABASE_URL` or `DATABASE_URL_SYNC` and reports in-memory mode.
- **Authenticated API requests:** set `API_KEY` and run Redis, or use the explicit loopback-only development mode below. Normal mode returns 503 if Redis is unavailable.
- **Sessions and workflow runs:** configure PostgreSQL and apply the schema. In-memory startup is not a substitute for persistent sessions or workflow checkpoints; `/api/workflow/run` needs a database run record.
- **LLM-backed execution:** run a configured Ollama model, or configure a supported hosted provider and its key. Ollama is the default path. API startup and catalog inspection do not require a model call.

Hosted model requests may incur provider charges. No model call is needed for the startup checks below.

## Local startup check

Run from the repository root so the agent, skill, and workflow paths resolve correctly:

```bash
git clone https://github.com/Houdinnie/Devora.git
cd Devora
npm install
npx tsx src/api/server.ts
```

Without a local `.env` or overrides, the API listens on **port 3000**. `PORT` overrides it; port 3100 is not the default. The development watch command is `npm run dev`.

In another terminal:

```bash
curl -i http://localhost:3000/liveness
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/agent
```

Expected for a startup-only check with no database, Redis, or Ollama:

- `/liveness` returns 200.
- `/health` returns 503 with `services.api: true` and the other services false. This means the API process is up, not that the full stack is ready.
- `/api/agent` without a key returns 401 with `Missing API key`.

The server binds to `0.0.0.0`; keep a development instance behind local firewall controls and do not expose it publicly.

## Configure a usable API

```bash
cp .env.example .env
openssl rand -hex 32
```

Put the generated value in `API_KEY` in your local `.env`. Do not commit it. Configure:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; default `3000` |
| `API_KEY` | Bootstrap administrator credential |
| `DATABASE_URL` | PostgreSQL connection string; `DATABASE_URL_SYNC` is a fallback |
| `REDIS_URL` | Redis URL; default `redis://redis:6379`, so set it for a host-local Redis |
| `OLLAMA_BASE_URL` / `OLLAMA_HOST` | Ollama address; default `http://localhost:11434` |
| `CORS_ORIGIN` | Comma-separated browser-origin allowlist |
| `OPENROUTER_API_KEY` / `HF_TOKEN` | Optional hosted-provider credentials |
| `DEVORA_REPOSITORIES_DIR` | Allow-listed parent directory for local repositories |
| `DEVORA_WORKTREE_DIR` | Optional root for isolated worktrees |

The copied example contains a database URL with placeholder credentials. Replace it before using PostgreSQL, or remove both database URL variables for a startup-only check.

For a new database:

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

For an existing database upgrading to workflow checkpoints:

```bash
psql "$DATABASE_URL" -f src/db/migrations/002_workflow_checkpoints.sql
```

Restart the API after editing `.env`. With Redis running, export your local key into the terminal used for these requests:

```bash
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/agent
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/workflow
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/skills
```

These are catalog reads, not LLM executions.

## Authentication and boundaries

All `/api` routes require authentication. `/health`, `/ready`, and `/liveness` are public. The server has no automatically registered default API key. In production, startup is blocked unless `API_KEY` is a non-default secret of at least 32 characters.

The environment key has read, execute, and admin permissions. Database API keys are hashed, support expiry and revocation, and are returned once when created. Keep both kinds of key private. Same-origin dashboard requests are accepted; other browser origins must match `CORS_ORIGIN`; non-browser requests do not need an Origin header.

Do not treat an agent prompt as a security boundary or a workflow output as a verified result. Review generated output before applying it to code, infrastructure, or external systems.

## Dashboard: local, Redis-free catalog demo

Run from the repository root:

```bash
npm install
export API_KEY=$(openssl rand -hex 32)
NODE_ENV=development DEVORA_LOCAL_DEV=true npx tsx src/api/server.ts
```

Open **http://127.0.0.1:3000/dashboard/** (adjust the port if you set `PORT`). In your own terminal, copy your generated `API_KEY`, paste it into the password-only connection field, and click Connect. Do not show your terminal key in a recording. The field is cleared immediately; the key stays only in that tab's memory. Refreshing or Disconnect forgets it. Never put a real key in source, a URL, or browser storage. Open the dashboard through the API, not `file://` or a separate static server.

This mode requires both `NODE_ENV=development` and `DEVORA_LOCAL_DEV=true`. It binds **only to 127.0.0.1** and uses an in-process 100-request/minute per-user/path limiter. Counts reset on process restart and are not shared across processes, so this is not a deployment mode. Startup rejects the flag outside development, including production. API authentication remains required. Normal/production mode still uses Redis and fails closed with 503 when Redis is unavailable. Do not place a proxy or tunnel in front of local mode.

The dashboard is served at `/dashboard/` with Helmet's default CSP and same-origin requests. No built-in credential is registered or embedded. For a normal Redis-backed server, the same dashboard works with a configured API key. Only dashboard assets are served, not repository files or `.env`.

After Connect, Agents, Skills and Workflows show live catalogs; Chat shows the real session/catalog state. The status distinguishes an online process from an authenticated dashboard. A connected catalog is not proof that an LLM has run. Sending Chat calls `POST /api/compose` after a model-cost confirmation; API failures are displayed, never replaced by invented assistant replies. Execution needs a configured model and may incur provider charges. No model execution is part of the free demo.

Provider credentials belong on the server. The former browser-localStorage provider-key form has been removed because it did not configure the API. Clear old `devora_api_keys` browser storage if you used an older dashboard. Restart, View Logs, Clear All Data, Business pages, model cards and create/upload controls remain unsupported or placeholders; they are not part of the verified recording path. Skills checkboxes are catalog-only and disabled. Keep recordings to Chat, Agents, Skills and Workflows.

Health can still report 503/API true with Redis, database and Ollama false. Local mode does not pretend those services are ready. Persistent sessions and workflow runs still need PostgreSQL.

## Workflow orchestration V2

Workflow steps support bounded parallel execution (`concurrency`, default 3; maximum 16), dependency validation, retries (`retries`, default 1 retry), and per-step timeouts (`timeout_ms`, default 120000; maximum 600000). Independent steps may run together; dependent steps wait for successful dependencies. Failed dependencies are skipped, cycles and unknown dependencies are reported, and cancellation propagates to supported model HTTP requests.

Cancel a run with `POST /api/workflow/runs/:runId/cancel` and inspect it with `GET /api/workflow/runs/:runId`. PostgreSQL stores cancellation requests and per-step checkpoints in `workflow_run_steps`. Same-process cancellation uses an abort controller; other instances sharing the database can request cancellation through the persisted flag.

To provide an isolated workspace, pass `repositoryPath` and optionally `baseRef` to `/api/workflow/run`. Configure `DEVORA_REPOSITORIES_DIR` as an allow-listed parent directory. Steps get detached worktrees; remote URLs and paths outside the allowlist are rejected. Worktrees remain after a run for review. Clean them up with `DELETE /api/workflow/runs/:runId/worktrees` after preserving any changes you need.

With `repositoryPath` enabled, Devora now supplies a bounded snapshot of tracked/untracked text files to the agent and accepts a strict JSON file-edit response, applying edits only inside that step's worktree. File paths are checked against traversal, symlink escapes, secret files, `.git`, and `node_modules`; each step is limited to 20 files and 500 KB of edits. This is a deliberately shell-free executor: it does not run model-suggested shell commands or automatically run the project's tests. Review the worktree diff and run the appropriate quality checks before merging changes.

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health`, `/ready`, `/liveness` | Public service checks |
| GET | `/api` | Authenticated API information |
| GET | `/api/agent`, `/api/agent/:id` | Agent catalog and detail |
| POST | `/api/agent/:id/execute` | LLM-backed agent execution |
| GET | `/api/workflow`, `/api/workflow/:name` | Workflow catalog and definition |
| POST | `/api/workflow/run` | Run a workflow with database persistence |
| GET | `/api/workflow/runs/:runId` | Persisted run and step state |
| POST | `/api/workflow/runs/:runId/cancel` | Request cancellation |
| DELETE | `/api/workflow/runs/:runId/worktrees` | Clean up recorded worktrees |
| GET, POST | `/api/sessions` | List or create sessions |
| GET | `/api/sessions/:id/history` | Session history |
| GET | `/api/skills` | Skill catalog |
| POST | `/api/apikeys` | Create a database API key |

Additional route modules are under `src/api/routes/`. Their presence does not establish production readiness.

## Development checks

```bash
npm run typecheck
npm run build
npm test
```

Tests cover authentication, workflow scheduling, and isolated worktree safety. They do not replace end-to-end checks with real databases, model providers, or the dashboard.

The repository currently tracks `node_modules`. If tests fail because Rollup's native binary is for another platform, reinstall dependencies and the matching native package. Linux x64 CI explicitly installs `@rollup/rollup-linux-x64-gnu` at the installed Rollup version.

## Docker configuration

`docker/docker-compose.yml` defines API, PostgreSQL, Redis, and Ollama services. It binds the API to `127.0.0.1:3000` by default and keeps the other services internal. It requires local database credentials and `API_KEY` and pulls Ollama models on startup.

The Docker build is not verified by the startup-only check above. The current Dockerfile uses `npm ci`, but this repository has no root lockfile, and its builder installs production dependencies before compiling TypeScript. Resolve the build setup before relying on Compose as a working deployment path.

## Project layout

```text
src/api/             Express server, middleware, and route modules
src/orchestrator/    Agent registry, LLM calls, scheduler, worktree management
src/memory/          Sessions and Redis helpers
src/db/              PostgreSQL client, schema, and migrations
src/streaming/       Server-sent events
agents/              Markdown agent prompts
skills/              Markdown task instructions
workflows/           YAML workflow templates
dashboard/           Static HTML, CSS, and JavaScript frontend
tests/               Authentication, scheduler, and worktree tests
docker/              Dockerfile and Compose configuration
```
