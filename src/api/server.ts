import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authMiddleware, registerApiKey } from './middleware/authMiddleware.js';
import { rateLimitMiddleware } from './middleware/authMiddleware.js';
import { healthCheckHandler, readyCheckHandler, livenessHandler } from './routes/health.js';
import { listAgents } from '../orchestrator/agent-registry.js';

registerApiKey('agency-dev-key-change-in-production', 'dev-key', ['read', 'execute', 'admin']);

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

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

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

app.get('/api', async (req: Request, res: Response) => {
  const agents = await listAgents();
  res.json({
    name: 'Devora - AI Orchestra',
    version: '1.0.0',
    database: 'connected',
    agentsLoaded: agents.length,
    endpoints: {
      compose: 'POST /api/compose',
      workflow: {
        list: 'GET /api/workflow',
        run: 'POST /api/workflow/run',
        get: 'GET /api/workflow/:name',
      },
      agent: {
        list: 'GET /api/agent',
        get: 'GET /api/agent/:id',
        execute: 'POST /api/agent/:id/execute',
      },
      session: {
        list: 'GET /api/sessions',
        create: 'POST /api/sessions',
        get: 'GET /api/session/:id',
        history: 'GET /api/session/:id/history',
      },
    },
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

app.use((err: ErrorWithStatus, req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : err.code || 'Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  const agents = await listAgents();
  console.log(`🎼 Devora - AI Orchestra running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  console.log(`👥 Agents loaded: ${agents.length}`);
  console.log(`🗄️ Database: connected`);
});

export default app;