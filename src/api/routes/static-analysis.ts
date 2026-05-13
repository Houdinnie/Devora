import { Router, Request, Response } from 'express';

const router = Router();

interface ScanRequest {
  scan_type: 'dead_code' | 'security' | 'secrets' | 'ai_guardrails' | 'llm_defense' | 'full';
  path?: string;
  diff_branch?: string;
}

interface Finding {
  type: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  code?: string;
}

const MOCK_FINDINGS: Record<string, Finding[]> = {
  dead_code: [
    { type: 'unused_function', severity: 'medium', file: 'src/utils.py', line: 42, message: "Function 'unused_helper' is never called" },
    { type: 'unused_class', severity: 'medium', file: 'src/models.py', line: 10, message: "Class 'OldModel' is never instantiated" },
  ],
  security: [
    { type: 'sql_injection', severity: 'critical', file: 'db.py', line: 42, code: "cursor.execute(f'SELECT * FROM {table}')", message: 'SQL injection via string interpolation' },
    { type: 'hardcoded_secret', severity: 'high', file: 'config.py', line: 8, message: 'Hardcoded API key detected' },
  ],
  secrets: [
    { type: 'api_key', severity: 'high', file: '.env', line: 5, message: 'Potential OpenAI API key detected' },
  ],
  ai_guardrails: [
    { type: 'missing_timeout', severity: 'high', file: 'client.py', line: 15, message: 'Network call without timeout parameter' },
    { type: 'removed_auth', severity: 'critical', file: 'auth.py', line: 30, message: 'Auth decorator might have been removed' },
  ],
  llm_defense: [
    { type: 'prompt_injection', severity: 'critical', file: 'app.py', line: 42, message: 'User input concatenated with system prompt' },
    { type: 'missing_rate_limit', severity: 'high', file: 'api.py', line: 10, message: 'LLM endpoint without rate limiting' },
  ],
};

router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { scan_type, path = '.', diff_branch } = req.body as ScanRequest;

    const findings: Finding[] = [];

    if (scan_type === 'full') {
      Object.values(MOCK_FINDINGS).forEach(f => findings.push(...f));
    } else if (MOCK_FINDINGS[scan_type]) {
      findings.push(...MOCK_FINDINGS[scan_type]);
    }

    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    const exitCode = severityCounts.critical > 0 ? 3 :
                     severityCounts.high > 0 ? 2 :
                     severityCounts.medium > 0 ? 1 : 0;

    res.json({
      scan_type,
      path,
      diff_branch,
      findings,
      summary: {
        total: findings.length,
        ...severityCounts,
      },
      exit_code: exitCode,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

router.get('/types', (_req: Request, res: Response) => {
  res.json({
    scan_types: [
      { id: 'dead_code', name: 'Dead Code Detection', description: 'Find unused functions, classes, imports' },
      { id: 'security', name: 'Security Scan', description: 'SQL injection, XSS, SSRF, path traversal' },
      { id: 'secrets', name: 'Secrets Detection', description: 'API keys, tokens, credentials' },
      { id: 'ai_guardrails', name: 'AI Code Guardrails', description: 'Detect AI regression issues' },
      { id: 'llm_defense', name: 'LLM App Defense', description: 'OWASP LLM Top 10 risks' },
      { id: 'full', name: 'Full Scan', description: 'All checks combined' },
    ],
  });
});

router.get('/frameworks', (_req: Request, res: Response) => {
  res.json({
    supported_frameworks: {
      python: ['FastAPI', 'Django', 'Flask', 'pytest', 'SQLAlchemy'],
      javascript: ['Next.js', 'React', 'Express', 'Vue'],
      java: ['Spring Boot', 'JUnit'],
      go: ['Standard library'],
      php: ['Laravel', 'Symfony'],
      rust: ['Standard library'],
    },
  });
});

export default router;