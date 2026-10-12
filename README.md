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
- **Authenticated API requests:** set `API_KEY` and run Redis. The current rate limiter uses Redis and returns 503 if it is unavailable.
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

The environment key has read, execute, and admin permissions. Database API keys are hashed, support expiry and revocation, and are returned once when created. Keep both kinds of key private. Browser requests must match `CORS_ORIGIN`; non-browser requests do not need an Origin header.

Do not treat an agent prompt as a security boundary or a workflow output as a verified result. Review generated output before applying it to code, infrastructure, or external systems.

## Dashboard

`dashboard/index.html` is a static frontend. Recent fixes replaced emoji icons with inline SVG, corrected the sidebar and a JavaScript syntax error, removed invented activity/cost numbers, and changed status text to use API health data. The Agents view is no longer capped at six entries. Settings hides the API-key value, and provider-key inputs use password fields.

The dashboard still needs integration work with the current server:

- `dashboard/js/app.js` contains an old hardcoded development credential. Hiding it in Settings does not remove it from source or make it a secret. The current server does not register that value automatically. Do not reuse it or put a real administrator key in public JavaScript.
- Requests use relative URLs when served over HTTP. The API does not currently serve the dashboard; a separate static server needs a same-origin proxy or a frontend API-base change plus an explicit CORS allowlist.
- The intended file-open fallback targets `localhost:3000`, but its `window.location.origin` check is unreliable for `file://` pages. Opening the HTML directly is not a verified setup path.
- Restart, View Logs, Clear All Data, Business pages, and model cards include placeholders. A visible control or catalog entry is not proof of a working action.

## Workflow orchestration V2

Workflow steps support bounded parallel execution (`concurrency`, default 3; maximum 16), dependency validation, retries (`retries`, default 1 retry), and per-step timeouts (`timeout_ms`, default 120000; maximum 600000). Independent steps may run together; dependent steps wait for successful dependencies. Failed dependencies are skipped, cycles and unknown dependencies are reported, and cancellation propagates to supported model HTTP requests.

Cancel a run with `POST /api/workflow/runs/:runId/cancel` and inspect it with `GET /api/workflow/runs/:runId`. PostgreSQL stores cancellation requests and per-step checkpoints in `workflow_run_steps`. Same-process cancellation uses an abort controller; other instances sharing the database can request cancellation through the persisted flag.

To provide an isolated workspace, pass `repositoryPath` and optionally `baseRef` to `/api/workflow/run`. Configure `DEVORA_REPOSITORIES_DIR` as an allow-listed parent directory. Steps get detached worktrees; remote URLs and paths outside the allowlist are rejected. Worktrees remain after a run for review. Clean them up with `DELETE /api/workflow/runs/:runId/worktrees` after preserving any changes you need.

The agent runtime is LLM-prompt based and does not expose a shell/file-edit tool API. A worktree path in the prompt does not itself clone remote repositories, execute commands, or edit files.

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
