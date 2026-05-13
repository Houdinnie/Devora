import { Router, Request, Response } from 'express';

const router = Router();

interface SwarmTask {
  task: string;
  context: {
    user_id?: string;
    nationality?: string;
    current_jurisdiction?: string;
    capital_available?: number;
    business_type?: string;
    goals?: string[];
  };
  preferred_swarm?: string;
}

interface SwarmResponse {
  session_id: string;
  result: string;
  swarm_used: string;
  confidence_score: number;
  sources_cited: string[];
  disclaimer: string;
  escalation_triggered: boolean;
  task_id?: string;
}

const SWARM_CAPABILITIES: Record<string, string[]> = {
  'central-swarm': ['coordination', 'routing', 'escalation', 'decision-aggregation'],
  'engineering-swarm': ['web-development', 'mobile-development', 'api-design', 'infrastructure'],
  'legal-swarm': ['entity-formation', 'contract-review', 'compliance', 'ip-protection'],
  'financial-swarm': ['bookkeeping', 'tax-optimization', 'financial-reporting', 'treasury'],
  'capital-swarm': ['fundraising', 'investor-matching', 'pitch-deck', 'cap-table'],
  'growth-swarm': ['seo', 'content-marketing', 'paid-acquisition', 'brand-strategy'],
  'web3-swarm': ['wallet-management', 'exchange-setup', 'defi-strategy', 'token-launch'],
  'wealth-swarm': ['portfolio-management', 'asset-allocation', 'retirement-planning'],
  'mobility-swarm': ['visa-processing', 'residency-application', 'travel-logistics'],
  'journey-swarm': ['healthcare', 'education', 'concierge', 'social-networks'],
};

const ESCALATION_TRIGGERS = {
  capital_raise_amount: 500000,
  confidence_threshold: 0.70,
  crypto_transaction: 10000,
  tax_liability_estimate: 100000,
};

const JURISDICTION_DISCLAIMERS: Record<string, string> = {
  US: 'This is not tax advice. Consult a qualified US tax professional. FATCA reporting may apply.',
  EU: 'This is not legal advice. Consult a qualified local attorney. GDPR data processing terms apply.',
  UAE: 'This is not legal advice. Consult a qualified UAE legal consultant. Commercial Companies Law compliance required.',
  default: 'VentureMind provides information only. Verify all recommendations with qualified professionals in your jurisdiction.',
};

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { task, context, preferred_swarm } = req.body as SwarmTask;

    if (!task) {
      res.status(400).json({ error: 'Task is required' });
      return;
    }

    const session_id = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let swarm_used = preferred_swarm || 'central-swarm';
    let confidence_score = 0.85;

    if (!preferred_swarm) {
      const task_lower = task.toLowerCase();
      if (task_lower.includes('code') || task_lower.includes('build') || task_lower.includes('deploy')) {
        swarm_used = 'engineering-swarm';
      } else if (task_lower.includes('legal') || task_lower.includes('entity') || task_lower.includes('company')) {
        swarm_used = 'legal-swarm';
      } else if (task_lower.includes('tax') || task_lower.includes('accounting') || task_lower.includes('bookkeep')) {
        swarm_used = 'financial-swarm';
      } else if (task_lower.includes('fund') || task_lower.includes('investor') || task_lower.includes('pitch')) {
        swarm_used = 'capital-swarm';
      } else if (task_lower.includes('marketing') || task_lower.includes('seo') || task_lower.includes('content')) {
        swarm_used = 'growth-swarm';
      } else if (task_lower.includes('crypto') || task_lower.includes('wallet') || task_lower.includes('defi')) {
        swarm_used = 'web3-swarm';
      } else if (task_lower.includes('invest') || task_lower.includes('portfolio') || task_lower.includes('wealth')) {
        swarm_used = 'wealth-swarm';
      } else if (task_lower.includes('visa') || task_lower.includes('residency') || task_lower.includes('relocate')) {
        swarm_used = 'mobility-swarm';
      } else if (task_lower.includes('health') || task_lower.includes('insurance') || task_lower.includes('lifestyle')) {
        swarm_used = 'journey-swarm';
      }
    }

    const escalation_triggered = checkEscalation(task, context, confidence_score);
    const disclaimer = JURISDICTION_DISCLAIMERS[context.current_jurisdiction || 'default'];

    const response: SwarmResponse = {
      session_id,
      result: `Task "${task}" processed by ${swarm_used}. This is a simulated response for demonstration.`,
      swarm_used,
      confidence_score,
      sources_cited: ['VentureMind documentation', 'Official government sources'],
      disclaimer,
      escalation_triggered,
    };

    if (escalation_triggered) {
      response.task_id = `task_${Date.now()}`;
    }

    res.json(response);
  } catch (error) {
    console.error('Swarm execution error:', error);
    res.status(500).json({ error: 'Swarm execution failed' });
  }
});

function checkEscalation(task: string, context: any, confidence: number): boolean {
  if (confidence < ESCALATION_TRIGGERS.confidence_threshold) return true;
  if (context?.capital_available > ESCALATION_TRIGGERS.capital_raise_amount) return true;
  if (task.toLowerCase().includes('crypto') && context?.capital_available > ESCALATION_TRIGGERS.crypto_transaction) return true;
  return false;
}

router.get('/list', (_req: Request, res: Response) => {
  const swarms = Object.entries(SWARM_CAPABILITIES).map(([name, capabilities]) => ({
    name,
    capabilities,
    status: 'active',
  }));

  res.json({
    swarms,
    count: swarms.length,
  });
});

router.get('/capabilities/:swarm', (req: Request, res: Response) => {
  const { swarm } = req.params;
  const capabilities = SWARM_CAPABILITIES[swarm];

  if (!capabilities) {
    res.status(404).json({ error: 'Swarm not found' });
    return;
  }

  res.json({
    swarm,
    capabilities,
  });
});

export default router;