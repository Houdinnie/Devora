import { Router, Request, Response } from 'express';

const router = Router();

// In-memory business data (would use database in production)
const businessData = {
    leads: [],
    deals: [],
    contacts: [],
    campaigns: [],
    projects: [],
    tasks: [],
    invoices: [],
    expenses: [],
    tickets: [],
    products: [],
    orders: [],
    employees: [],
    contracts: []
};

// ===== CRM Routes =====
router.get('/crm/leads', (req: Request, res: Response) => {
    res.json({ leads: businessData.leads, count: businessData.leads.length });
});

router.post('/crm/leads', (req: Request, res: Response) => {
    const lead = {
        id: 'lead-' + Date.now(),
        ...req.body,
        stage: 'lead',
        created_at: new Date().toISOString()
    };
    businessData.leads.push(lead);
    res.json({ success: true, lead });
});

router.put('/crm/leads/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const index = businessData.leads.findIndex((l: any) => l.id === id);
    if (index >= 0) {
        businessData.leads[index] = { ...businessData.leads[index], ...req.body };
        res.json({ success: true, lead: businessData.leads[index] });
    } else {
        res.status(404).json({ error: 'Lead not found' });
    }
});

router.get('/crm/deals', (req: Request, res: Response) => {
    res.json({ deals: businessData.deals, count: businessData.deals.length });
});

router.post('/crm/deals', (req: Request, res: Response) => {
    const deal = {
        id: 'deal-' + Date.now(),
        ...req.body,
        stage: 'prospect',
        created_at: new Date().toISOString()
    };
    businessData.deals.push(deal);
    res.json({ success: true, deal });
});

// ===== Marketing Routes =====
router.get('/marketing/campaigns', (req: Request, res: Response) => {
    res.json({ campaigns: businessData.campaigns, count: businessData.campaigns.length });
});

router.post('/marketing/campaigns', (req: Request, res: Response) => {
    const campaign = {
        id: 'campaign-' + Date.now(),
        ...req.body,
        status: 'draft',
        created_at: new Date().toISOString()
    };
    businessData.campaigns.push(campaign);
    res.json({ success: true, campaign });
});

// ===== Projects Routes =====
router.get('/projects', (req: Request, res: Response) => {
    res.json({ projects: businessData.projects, count: businessData.projects.length });
});

router.post('/projects', (req: Request, res: Response) => {
    const project = {
        id: 'project-' + Date.now(),
        ...req.body,
        status: 'active',
        created_at: new Date().toISOString()
    };
    businessData.projects.push(project);
    res.json({ success: true, project });
});

router.get('/tasks', (req: Request, res: Response) => {
    res.json({ tasks: businessData.tasks, count: businessData.tasks.length });
});

router.post('/tasks', (req: Request, res: Response) => {
    const task = {
        id: 'task-' + Date.now(),
        ...req.body,
        status: 'todo',
        created_at: new Date().toISOString()
    };
    businessData.tasks.push(task);
    res.json({ success: true, task });
});

// ===== Finance Routes =====
router.get('/finance/invoices', (req: Request, res: Response) => {
    res.json({ invoices: businessData.invoices, count: businessData.invoices.length });
});

router.post('/finance/invoices', (req: Request, res: Response) => {
    const invoice = {
        id: 'inv-' + Date.now(),
        ...req.body,
        status: 'draft',
        created_at: new Date().toISOString()
    };
    businessData.invoices.push(invoice);
    res.json({ success: true, invoice });
});

router.get('/finance/expenses', (req: Request, res: Response) => {
    res.json({ expenses: businessData.expenses, count: businessData.expenses.length });
});

router.post('/finance/expenses', (req: Request, res: Response) => {
    const expense = {
        id: 'exp-' + Date.now(),
        ...req.body,
        created_at: new Date().toISOString()
    };
    businessData.expenses.push(expense);
    res.json({ success: true, expense });
});

// ===== Support Routes =====
router.get('/support/tickets', (req: Request, res: Response) => {
    res.json({ tickets: businessData.tickets, count: businessData.tickets.length });
});

router.post('/support/tickets', (req: Request, res: Response) => {
    const ticket = {
        id: 'ticket-' + Date.now(),
        ...req.body,
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString()
    };
    businessData.tickets.push(ticket);
    res.json({ success: true, ticket });
});

// ===== Inventory Routes =====
router.get('/inventory/products', (req: Request, res: Response) => {
    res.json({ products: businessData.products, count: businessData.products.length });
});

router.post('/inventory/products', (req: Request, res: Response) => {
    const product = {
        id: 'product-' + Date.now(),
        ...req.body,
        stock: 0,
        created_at: new Date().toISOString()
    };
    businessData.products.push(product);
    res.json({ success: true, product });
});

// ===== HR Routes =====
router.get('/hr/employees', (req: Request, res: Response) => {
    res.json({ employees: businessData.employees, count: businessData.employees.length });
});

router.post('/hr/employees', (req: Request, res: Response) => {
    const employee = {
        id: 'emp-' + Date.now(),
        ...req.body,
        status: 'active',
        created_at: new Date().toISOString()
    };
    businessData.employees.push(employee);
    res.json({ success: true, employee });
});

// ===== Legal Routes =====
router.get('/legal/contracts', (req: Request, res: Response) => {
    res.json({ contracts: businessData.contracts, count: businessData.contracts.length });
});

router.post('/legal/contracts', (req: Request, res: Response) => {
    const contract = {
        id: 'contract-' + Date.now(),
        ...req.body,
        status: 'draft',
        created_at: new Date().toISOString()
    };
    businessData.contracts.push(contract);
    res.json({ success: true, contract });
});

// ===== Stats Summary =====
router.get('/stats', (req: Request, res: Response) => {
    res.json({
        crm: { leads: businessData.leads.length, deals: businessData.deals.length },
        marketing: { campaigns: businessData.campaigns.length },
        projects: { projects: businessData.projects.length, tasks: businessData.tasks.length },
        finance: { invoices: businessData.invoices.length, expenses: businessData.expenses.length },
        support: { tickets: businessData.tickets.length },
        inventory: { products: businessData.products.length },
        hr: { employees: businessData.employees.length },
        legal: { contracts: businessData.contracts.length }
    });
});

export default router;