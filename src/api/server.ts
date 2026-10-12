import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { authMiddleware, registerApiKey } from './middleware/authMiddleware.js';
import { rateLimitMiddleware } from './middleware/authMiddleware.js';
import { healthCheckHandler, readyCheckHandler, livenessHandler } from './routes/health.js';
import { listAgents } from '../orchestrator/agent-registry.js';

import composeRoute from './routes/compose.js';
import workflowRoute from './routes/workflow.js';
import agentRoute from './routes/agent.js';
import sessionRoute from './routes/session.js';
import apikeyRoute from './routes/apikey.js';
import skillsRoute from './routes/skills.js';
import channelsRoute from './routes/channels.js';
import adminRoute from './routes/admin.js';
import businessRoute from './routes/business.js';
import swarmRoute from './routes/swarm.js';
import securityAuditRoute from './routes/security-audit.js';
import staticAnalysisRoute from './routes/static-analysis.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const configuredApiKey = process.env.API_KEY?.trim();

if (process.env.NODE_ENV === 'production' && (!configuredApiKey || configuredApiKey.length < 32 || configuredApiKey === 'agency-dev-key-change-in-production')) {
  throw new Error('Production startup blocked: set API_KEY to a unique secret of at least 32 characters.');
}
if (configuredApiKey) {
  registerApiKey(configuredApiKey, 'environment-key', ['read', 'execute', 'admin']);
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app: Express = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients omit Origin. Browser origins must be explicitly listed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', healthCheckHandler);
app.get('/ready', readyCheckHandler);
app.get('/liveness', livenessHandler);

app.use('/api', authMiddleware);
app.use('/api', rateLimitMiddleware(100, 60));

app.use('/api/compose', composeRoute);
app.use('/api/workflow', workflowRoute);
app.use('/api/agent', agentRoute);
app.use('/api/sessions', sessionRoute);
app.use('/api/apikeys', apikeyRoute);
app.use('/api/skills', skillsRoute);
app.use('/api/channels', channelsRoute);
app.use('/api/admin', adminRoute);
app.use('/api/business', businessRoute);
app.use('/api/swarm', swarmRoute);
app.use('/api/security', securityAuditRoute);
app.use('/api/scan', staticAnalysisRoute);

app.get('/api', async (_req: Request, res: Response) => {
  const agents = await listAgents();
  res.json({
    name: 'Devora - AI Orchestra',
    version: '2.0.0',
    agentsLoaded: agents.length,
    endpoints: {
      compose: 'POST /api/compose',
      workflow: { list: 'GET /api/workflow', run: 'POST /api/workflow/run', get: 'GET /api/workflow/:name' },
      agent: { list: 'GET /api/agent', get: 'GET /api/agent/:id', execute: 'POST /api/agent/:id/execute' },
      session: { list: 'GET /api/sessions', create: 'POST /api/sessions', get: 'GET /api/session/:id', history: 'GET /api/session/:id/history' },
    },
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

interface ErrorWithStatus extends Error { status?: number; code?: string; }
app.use((err: ErrorWithStatus, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  const clientMessage = status >= 500 ? 'An unexpected server error occurred.' : (err.message || 'Request failed.');
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (err.code || 'Error'),
    message: clientMessage,
  });
});

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.warn('CORS_ORIGIN is empty: browser-origin requests are denied until an allowlist is configured.');
}

app.listen(PORT, '0.0.0.0', async () => {
  try {
    const agents = await listAgents();
    console.log(`🎼 Devora API listening on port ${PORT}; agents loaded: ${agents.length}`);
  } catch (error) {
    console.error('API started but agent registry initialization failed:', error);
  }
});

export default app;
