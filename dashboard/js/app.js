// The dashboard is served by the API. file:// is deliberately unsupported.
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
let apiKey = ''; // Tab memory only: never source, URL, logs or browser storage.
let dashboardConnected = false;
function ic(name) {
    return `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ===== Debug =====
console.log('Devora Dashboard initializing...');
console.log('API Base:', API_BASE);

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? ic('check') : type === 'error' ? ic('x') : ic('info')}</span>
        <span class="toast-message">${esc(message)}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== API Functions =====
async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || `API returned ${response.status}`);
    return data;
}

async function connectDashboard(event) {
    event.preventDefault();
    const input = document.getElementById('connectionKey');
    apiKey = input.value.trim();
    input.value = '';
    try {
        await fetchAPI('/api');
        await loadDashboardData();
        dashboardConnected = true;
        document.getElementById('connectionStatus').textContent = 'Authenticated. Key kept in this tab only.';
        document.getElementById('apiKeyState').textContent = 'Connected (tab memory only)';
        document.getElementById('chatStatus').textContent = 'Catalog connected. Chat execution requires a configured model; hosted providers may charge.';
        setApiStatus(await checkHealth());
    } catch (error) {
        disconnectDashboard();
        document.getElementById('connectionStatus').textContent = error.message;
    }
}
function disconnectDashboard() {
    apiKey = '';
    dashboardConnected = false;
    document.getElementById('connectionKey').value = '';
    document.getElementById('connectionStatus').textContent = 'Disconnected. Enter your local API key to load catalogs.';
    document.getElementById('apiKeyState').textContent = 'Not connected';
    for (const id of ['apiStatusText', 'gatewayText']) document.getElementById(id).textContent = 'API not connected';
    document.getElementById('chatStatus').textContent = 'Connect the API above. No model has run.';
    for (const selector of ['.agents-grid', '.skills-grid', '.workflows-grid', '.channels-grid']) {
        document.querySelector(selector).innerHTML = '<p>Connect the API to load live data.</p>';
    }
    updateSidebarBadges({ agents: {count: 0}, skills: {count: 0} });
    document.getElementById('liveSkillTotal').textContent = '-';
    document.getElementById('statSessions').textContent = '-';
    document.getElementById('statWorkflows').textContent = '-';
}

async function loadAgents() {
    const data = await fetchAPI('/api/agent');
    return data?.agents || [];
}

async function loadWorkflows() {
    const data = await fetchAPI('/api/workflow');
    return data?.workflows || [];
}

async function loadSkills() {
    const data = await fetchAPI('/api/skills');
    return data?.skills || [];
}

async function loadSessions() {
    const data = await fetchAPI('/api/sessions');
    return data?.sessions || [];
}

async function loadChannels() {
    const data = await fetchAPI('/api/channels');
    return data?.channels || [];
}

async function loadStats() {
    const data = await fetchAPI('/api/admin/stats');
    return data || { agents: { count: 0 }, skills: { count: 0 }, workflows: { count: 0 }, sessions: { count: 0 }, channels: { count: 0 } };
}

async function createAgent(name, division, description) {
    return await fetchAPI('/api/admin/agents', {
        method: 'POST',
        body: JSON.stringify({ name, division, description })
    });
}

async function createSkill(name, description, usage = '') {
    return await fetchAPI('/api/admin/skills', {
        method: 'POST',
        body: JSON.stringify({ name, description, usage })
    });
}

async function createChannel(name, type) {
    return await fetchAPI('/api/channels', {
        method: 'POST',
        body: JSON.stringify({ name, type, config: {} })
    });
}

async function connectChannel(id, credentials) {
    return await fetchAPI(`/api/channels/${id}/connect`, {
        method: 'PUT',
        body: JSON.stringify({ credentials })
    });
}

async function executeAgent(agentId, task) {
    return await fetchAPI(`/api/agent/${agentId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ task })
    });
}

async function runWorkflow(workflowName, inputs) {
    return await fetchAPI('/api/workflow/run', {
        method: 'POST',
        body: JSON.stringify({ workflow: workflowName, inputs })
    });
}

async function checkHealth() {
    // Call /health directly: fetchAPI would toast an error when the server is down.
    try {
        const res = await fetch(`${API_BASE}/health`);
        const health = await res.json();
        return { reachable: !!health?.services?.api, storage: health?.services?.database ? 'database' : 'in-memory', version: health?.version };
    } catch (e) {
        return { reachable: false };
    }
}

function setApiStatus(health) {
    const base = API_BASE || window.location.origin;
    const up = !!health.reachable;
    const dotClass = up ? 'online' : 'offline';
    for (const id of ['apiDot', 'gatewayDot']) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('online', 'offline'); el.classList.add(dotClass); }
    }
    const text = up ? (dashboardConnected ? 'API authenticated' : 'API online, not connected') : 'API offline';
    const t = document.getElementById('apiStatusText'); if (t) t.textContent = text;
    const g = document.getElementById('gatewayText'); if (g) g.textContent = text;
    const d = document.getElementById('gatewayDetail');
    if (d) d.textContent = up ? `${base.replace(/^https?:\/\//, '')} - ${health.storage}` : `Not reachable at ${base.replace(/^https?:\/\//, '')}`;
    const ss = document.getElementById('settingsGatewayStatus'); if (ss) ss.textContent = up ? `Online (${health.storage} storage)` : 'Offline';
    const sa = document.getElementById('settingsGatewayAddr'); if (sa) sa.textContent = base;
}

// ===== Navigation =====
console.log('Setting up navigation...');
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        console.log('Nav clicked:', item.dataset.section);
        const section = item.dataset.section;
        if (!section) return;
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
    });
});

// ===== Theme Toggle =====
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.dataset.theme = btn.dataset.theme;
    });
});

// ===== macOS Window Controls =====
function handleClose() {
    if (confirm('Close the application?')) {
        window.close();
    }
}

function handleMinimize() {
    // In a real Electron app, this would minimize
    console.log('Minimize window');
}

function handleMaximize() {
    // Toggle fullscreen
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// ===== Chat Functionality =====
const chatInput = document.getElementById('chatInput');
let chatHistory = [];

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!dashboardConnected) { showToast('Connect the API first.', 'error'); return; }
    if (!confirm('Run a configured model? Hosted providers may charge.')) return;
    addMessage('user', message);
    chatInput.value = '';
    const typingEl = addMessage('ai', 'Waiting for the API...');
    try {
        const response = await fetchAPI('/api/compose', { method: 'POST', body: JSON.stringify({ prompt: message, stream: false }) });
        typingEl.remove();
        addMessage('ai', response.output || response.error || 'The API returned no output.');
    } catch (error) {
        typingEl.remove();
        addMessage('ai', `Request failed: ${error.message}. No fallback answer was generated.`);
    }
    updateChatCount();
}

function addMessage(type, content) {
    const container = document.querySelector('.chat-container');
    const messagesContainer = container.querySelector('.messages') || createMessagesContainer(container);
    
    const messageEl = document.createElement('div');
    messageEl.className = type === 'user' ? 'message-user' : 'message-ai';
    messageEl.innerHTML = `
        <div class="message-content">${esc(content)}</div>
    `;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageEl;
}

function createMessagesContainer(container) {
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'messages';
    messagesContainer.style.cssText = `
        max-height: 400px;
        overflow-y: auto;
        margin-bottom: 20px;
    `;
    
    container.insertBefore(messagesContainer, container.querySelector('.quick-actions'));
    return messagesContainer;
}

function startChat(prompt) {
    chatInput.value = prompt;
    chatInput.focus();
}

function updateChatCount() {
    const count = document.querySelectorAll('.message-user').length;
    document.getElementById('chatCount').textContent = `${count} chats`;
}

// ===== Skills Toggle =====
document.querySelectorAll('.skill-toggle input').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
        const card = e.target.closest('.skill-card');
        if (e.target.checked) {
            card.classList.add('enabled');
        } else {
            card.classList.remove('enabled');
        }
    });
});

// ===== Provider Actions =====
function addProvider() {
    alert('Add Provider modal would open here.\n\nSupported providers:\n- OpenAI (GPT-4, GPT-3.5)\n- Anthropic (Claude)\n- Google (Gemini)\n- Ollama (local models)\n- DeepSeek\n- And more...');
}

// ===== Initialize =====
async function initDashboard() {
    disconnectDashboard();
    document.getElementById('connectionForm').addEventListener('submit', connectDashboard);
    document.getElementById('disconnectApi').addEventListener('click', disconnectDashboard);
    setApiStatus(await checkHealth());
}

async function loadDashboardData() {
    try {
        const [agents, workflows, sessions, skills, channels, stats] = await Promise.all([
            loadAgents(),
            loadWorkflows(),
            loadSessions(),
            loadSkills(),
            loadChannels(),
            loadStats()
        ]);
        
        console.log(`Loaded: ${agents.length} agents, ${workflows.length} workflows, ${sessions.length} sessions, ${skills.length} skills, ${channels.length} channels`);
        
        // Update sidebar badges with real counts
        updateSidebarBadges({ ...stats, agents: { count: agents.length }, skills: { count: skills.length } });
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('liveSkillTotal', skills.length);
        setText('statSessions', sessions.length);
        setText('statWorkflows', workflows.length);
        
        // Update UI with real data
        {
            updateAgentsGrid(agents);
        }
        {
            updateWorkflowsGrid(workflows);
        }
        {
            updateChannelsGrid(channels);
        }
        if (sessions.length > 0) {
            document.getElementById('chatCount').textContent = `${sessions.length} sessions`;
        }
        {
            updateSkillsGrid(skills);
        }
    } catch (error) {
        throw error;
    }
}

function updateAgentsGrid(agents) {
    const grid = document.querySelector('.agents-grid');
    if (!grid) return;
    
    grid.innerHTML = agents.map(agent => `
        <div class="agent-card">
            <div class="agent-avatar">${ic('bot')}</div>
            <div class="agent-info">
                <h3>${esc(agent.name)}</h3>
                <p class="agent-division">${esc(agent.division || 'Specialized')}</p>
                <p class="agent-specialty">${esc(agent.specialty || agent.role || agent.description || '')}</p>
            </div>
            ${(agent.capabilities || []).length ? `<div class="agent-stats"><span class="stat-pill">${agent.capabilities.length} capabilities</span></div>` : ''}
        </div>
    `).join('');
}

function updateWorkflowsGrid(workflows) {
    const grid = document.querySelector('.workflows-grid');
    if (!grid) return;
    
    grid.innerHTML = workflows.map(workflow => `
        <div class="workflow-card">
            <div class="workflow-header">
                <span class="workflow-icon"><svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg></span>
                <span class="workflow-name">${esc(workflow.name)}</span>
                <span class="workflow-status">${esc(workflow.category || 'workflow')}</span>
            </div>
            <p class="workflow-desc">${esc(workflow.description || '')}</p>
            <div class="workflow-meta">
                <span>${workflow.steps || 0} steps</span>
            </div>
        </div>
    `).join('');
}

function skillSummary(text) {
    // API descriptions start with the title, then a blank line, then the summary.
    const parts = String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    return (parts[1] || parts[0] || '').split('\n')[0].slice(0, 140);
}

function updateSkillsGrid(skills) {
    const grid = document.querySelector('.skills-grid');
    if (!grid) return;
    
    grid.innerHTML = skills.map(skill => `
        <div class="skill-card enabled">
            <div class="skill-header">
                <span class="skill-icon"><svg class="ic" aria-hidden="true"><use href="#i-zap"/></svg></span>
                <span class="skill-name">${esc(skill.title || skill.name)}</span>
                <label class="skill-toggle">
                    <input type="checkbox" checked disabled aria-label="Catalog only">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <p class="skill-desc">${esc(skillSummary(skill.description))}</p>
        </div>
    `).join('');
}

function updateChannelsGrid(channels) {
    const grid = document.querySelector('.channels-grid');
    if (!grid) return;
    
    const channelTypes = {
        discord: { icon: ic('message'), name: 'Discord' },
        telegram: { icon: ic('send'), name: 'Telegram' },
        slack: { icon: ic('briefcase'), name: 'Slack' },
        whatsapp: { icon: ic('phone'), name: 'WhatsApp' },
        twitter: { icon: ic('at'), name: 'Twitter/X' },
        email: { icon: ic('mail'), name: 'Email' }
    };
    
    if (channels.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${ic('phone')}</span>
                <h3>No channels connected</h3>
                <p>Connect a messaging channel to get started</p>
                <button class="primary-btn" onclick="showAddChannelModal()">Add Channel</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = channels.map(ch => {
        const typeInfo = channelTypes[ch.type] || { icon: ic('phone'), name: ch.type };
        return `
            <div class="channel-card ${ch.status}">
                <div class="channel-header">
                    <span class="channel-icon">${typeInfo.icon}</span>
                    <span class="channel-name">${ch.name}</span>
                    <span class="channel-status ${ch.status}">${ch.status}</span>
                </div>
                <div class="channel-info">
                    <p>Type: ${typeInfo.name}</p>
                </div>
                <div class="channel-actions">
                    ${ch.status === 'connected' ? '<span class="connected-label">Connected</span>' : '<button class="channel-connect-btn" onclick="connectChannelPrompt(\'' + ch.id + '\')">Connect</button>'}
                </div>
            </div>
        `;
    }).join('');
}

function updateSidebarBadges(stats) {
    // Update agent count
    const agentBadge = document.querySelector('.nav-item[data-section="agents"] .nav-badge');
    if (agentBadge && stats.agents) {
        agentBadge.textContent = stats.agents.count;
    }
    
    // Update skill count
    const skillBadge = document.querySelector('.nav-item[data-section="skills"] .nav-badge');
    if (skillBadge && stats.skills) {
        skillBadge.textContent = stats.skills.count;
    }
    
    // Update task count
    const taskCount = document.querySelector('.nav-item[data-section="tasks"] .task-count');
    if (taskCount && stats.sessions) {
        taskCount.textContent = stats.sessions.count;
    }
    
    // Update channel status
    const channelDot = document.querySelector('.nav-item[data-section="channels"] .status-dot');
    if (channelDot && stats.channels) {
        if (stats.channels.count > 0) {
            channelDot.classList.add('connected');
        } else {
            channelDot.classList.remove('connected');
        }
    }
}

// ===== Modal System =====
function showModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">${ic('x')}</button>
            </div>
            <div class="modal-body">${esc(content)}</div>
            ${buttons.length ? `<div class="modal-footer">${buttons.map(b => `<button class="${b.class || 'btn'}" onclick="${b.onclick}">${b.label}</button>`).join('')}</div>` : ''}
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    return modal;
}

function showAddChannelModal() {
    const divisions = ['discord', 'telegram', 'slack', 'whatsapp', 'twitter', 'email'];
    showModal('Add Channel', `
        <div class="form-group">
            <label>Channel Name</label>
            <input type="text" id="channelName" placeholder="My Channel">
        </div>
        <div class="form-group">
            <label>Channel Type</label>
            <select id="channelType">
                ${divisions.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'this.closest(".modal-overlay").remove()' },
        { label: 'Add Channel', class: 'btn-primary', onclick: `
            const name = document.getElementById('channelName').value;
            const type = document.getElementById('channelType').value;
            if(!name) { showToast('Please enter a name', 'error'); return; }
            createChannel(name, type).then(r => {
                if(r?.success) { showToast('Channel created!'); loadDashboardData(); }
                else { showToast('Failed: ' + (r?.error || 'Unknown'), 'error'); }
                this.closest('.modal-overlay').remove();
            });
        `}
    ]);
}

function showAddAgentModal() {
    const divisions = ['engineering', 'marketing', 'sales', 'product', 'design', 'operations', 'security', 'specialized', 'hr', 'finance', 'strategy', 'testing'];
    showModal('Add New Agent', `
        <div class="form-group">
            <label>Agent Name</label>
            <input type="text" id="agentName" placeholder="AI Assistant">
        </div>
        <div class="form-group">
            <label>Division</label>
            <select id="agentDivision">
                ${divisions.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="agentDesc" placeholder="What does this agent do?"></textarea>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'this.closest(".modal-overlay").remove()' },
        { label: 'Create Agent', class: 'btn-primary', onclick: `
            const name = document.getElementById('agentName').value;
            const division = document.getElementById('agentDivision').value;
            const description = document.getElementById('agentDesc').value || name + ' specialist';
            if(!name) { showToast('Please enter a name', 'error'); return; }
            createAgent(name, division, description).then(r => {
                if(r?.success) { showToast('Agent created!'); loadDashboardData(); }
                else { showToast('Failed: ' + (r?.error || 'Unknown'), 'error'); }
                this.closest('.modal-overlay').remove();
            });
        `}
    ]);
}

function showAddSkillModal() {
    showModal('Add New Skill', `
        <div class="form-group">
            <label>Skill Name</label>
            <input type="text" id="skillName" placeholder="data-analysis">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="skillDesc" placeholder="What does this skill do?"></textarea>
        </div>
        <div class="form-group">
            <label>Usage Example</label>
            <input type="text" id="skillUsage" placeholder="/skill-name task">
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'this.closest(".modal-overlay").remove()' },
        { label: 'Create Skill', class: 'btn-primary', onclick: `
            const name = document.getElementById('skillName').value;
            const description = document.getElementById('skillDesc').value || name + ' skill';
            const usage = document.getElementById('skillUsage').value || name.toLowerCase();
            if(!name) { showToast('Please enter a name', 'error'); return; }
            createSkill(name, description, usage).then(r => {
                if(r?.success) { showToast('Skill created!'); loadDashboardData(); }
                else { showToast('Failed: ' + (r?.error || 'Unknown'), 'error'); }
                this.closest('.modal-overlay').remove();
            });
        `}
    ]);
}

function showUploadModal() {
    showModal('Upload Files to Devora', `
        <div class="upload-zone" id="dropZone">
            <input type="file" id="fileInput" multiple accept=".md,.yaml,.yml,.json,.txt" style="display:none">
            <div class="upload-icon">${ic('folder')}</div>
            <p>Drag files here or click to browse</p>
            <span class="upload-hint">.md, .yaml, .yml, .json, .txt</span>
        </div>
        <div id="uploadList" class="upload-list"></div>
    `, [
        { label: 'Close', class: 'btn-secondary', onclick: 'this.closest(".modal-overlay").remove()' }
    ]);
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFiles(e.target.files);
    
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    };
}

function handleFiles(files) {
    const list = document.getElementById('uploadList');
    list.innerHTML = '';
    
    const unsupportedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    const textTypes = ['txt', 'md', 'json', 'yaml', 'yml', 'js', 'ts', 'html', 'css', 'py'];
    
    Array.from(files).forEach(file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        
        if (unsupportedTypes.includes(ext)) {
            showToast(`${ext.toUpperCase()} files cannot be processed by current AI models. Convert to text first.`, 'error');
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'upload-item';
        const icon = textTypes.includes(ext) ? ic('pen') : ic('file');
        item.innerHTML = `<span class="file-icon">${icon}</span><span class="file-name">${file.name}</span><span class="file-size">${(file.size/1024).toFixed(1)}KB</span>`;
        list.appendChild(item);
        showToast(`File ready: ${file.name}`);
    });
}

// Initialize upload button click
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const navItems = document.querySelectorAll('.nav-item');
        console.log('Nav items found:', navItems.length);
    }, 1000);
});

function connectChannelPrompt(id) {
    const creds = prompt('Enter credentials (JSON format):', '{}');
    try {
        const credentials = JSON.parse(creds || '{}');
        connectChannel(id, credentials).then(result => {
            if (result?.success) {
                alert('Channel connected!');
                loadDashboardData();
            } else {
                alert('Failed to connect channel');
            }
        });
    } catch (e) {
        alert('Invalid JSON format');
    }
}

console.log('Devora Dashboard loaded');
console.log('Use the sidebar to navigate between sections');

// Auto-save theme preference
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        localStorage.setItem('theme', btn.dataset.theme);
    });
});

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.dataset.theme = savedTheme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === savedTheme);
    });
}

// Initialize chat input position
function updateChatInputPosition() {
    const chatContainer = document.querySelector('.chat-input-container');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    if (window.innerWidth > 1024) {
        chatContainer.style.left = `calc(${sidebar.offsetWidth} + (100% - ${sidebar.offsetWidth} - ${content.offsetWidth}) / 2 + 20px)`;
        chatContainer.style.right = `calc((100% - ${sidebar.offsetWidth} - ${content.offsetWidth}) / 2 + 20px)`;
    } else {
        chatContainer.style.left = '20px';
        chatContainer.style.right = '20px';
    }
}

window.addEventListener('resize', updateChatInputPosition);
updateChatInputPosition();

// Start dashboard
initDashboard();

// ===== Business Module Functions =====
function addLead() {
    const company = document.getElementById('leadCompany')?.value;
    const contact = document.getElementById('leadContact')?.value;
    const email = document.getElementById('leadEmail')?.value;
    
    if (!company) {
        showToast('Please enter company name', 'error');
        return;
    }
    
    // Add to localStorage for demo
    const leads = JSON.parse(localStorage.getItem('devora_leads') || '[]');
    leads.push({
        id: 'lead-' + Date.now(),
        company,
        contact: contact || '',
        email: email || '',
        stage: 'lead',
        value: 0,
        created: new Date().toISOString()
    });
    localStorage.setItem('devora_leads', JSON.stringify(leads));
    
    showToast('Lead added successfully!', 'success');
    updateLeadStats();
}

function updateLeadStats() {
    const leads = JSON.parse(localStorage.getItem('devora_leads') || '[]');
    const countEl = document.getElementById('leadsCount');
    if (countEl) countEl.textContent = leads.length;
}

// Supported controls use external listeners under the default Helmet CSP.
document.querySelector('.send-btn').addEventListener('click', sendMessage);
document.querySelectorAll('.action-pill').forEach(button => {
    button.addEventListener('click', () => startChat(button.textContent.trim()));
});
