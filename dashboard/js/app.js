// ===== API Configuration =====
const API_BASE = window.location.origin.includes('file:') ? 'http://localhost:3000' : '';
const API_KEY = 'agency-dev-key-change-in-production';

const apiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
};

// ===== Debug =====
console.log('🎼 Devora Dashboard initializing...');
console.log('API Base:', API_BASE);

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="toast-message">${message}</span>
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
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...apiHeaders, ...options.headers }
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error.message);
        showToast('API connection failed', 'error');
        return null;
    }
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
    const health = await fetchAPI('/health');
    return health?.status === 'ok';
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
    
    addMessage('user', message);
    chatInput.value = '';
    chatHistory.push({ role: 'user', content: message });
    
    // Show typing indicator
    const typingEl = addMessage('ai', '<span class="typing">Thinking...</span>');
    
    try {
        // Try to use agent execution API
        const response = await executeAgent('chat', message);
        const reply = response?.result?.output || getAIResponse(message);
        typingEl.remove();
        addMessage('ai', reply);
        chatHistory.push({ role: 'assistant', content: reply });
    } catch (error) {
        typingEl.remove();
        addMessage('ai', getAIResponse(message));
    }
    
    updateChatCount();
}

function addMessage(type, content) {
    const container = document.querySelector('.chat-container');
    const messagesContainer = container.querySelector('.messages') || createMessagesContainer(container);
    
    const messageEl = document.createElement('div');
    messageEl.className = type === 'user' ? 'message-user' : 'message-ai';
    messageEl.innerHTML = `
        <div class="message-content">${content}</div>
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

function getAIResponse(message) {
    const lower = message.toLowerCase();
    
    if (lower.includes('task')) {
        return "I'll help you handle some tasks. Which agents would you like to deploy?";
    }
    if (lower.includes('workflow')) {
        return "Let me show you the available workflows. We have Code Review, Startup Launch, Security Audit, and more.";
    }
    if (lower.includes('agent')) {
        return "We have 12 specialized agents: Frontend Developer, Backend Architect, DevOps Engineer, Security Engineer, and more.";
    }
    if (lower.includes('code')) {
        return "I can help you with code. Let me spawn the code review workflow for your repository.";
    }
    if (lower.includes('deploy')) {
        return "I'll prepare the deployment. Let me coordinate with the DevOps agent.";
    }
    
    return "I understand. How would you like to proceed? You can:\n- Run a workflow\n- Chat with specific agents\n- Schedule a task\n- Analyze your codebase";
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
    console.log('🎼 Devora Dashboard loading...');
    
    // Check API health
    const healthy = await checkHealth();
    if (healthy) {
        console.log('✓ Connected to Devora API');
        document.querySelector('.status-indicator')?.classList.add('online');
        document.querySelector('.status-text').textContent = 'Connected to Devora';
        
        // Load data from API
        loadDashboardData();
    } else {
        console.log('⚠ API not available - running in demo mode');
        document.querySelector('.status-indicator')?.classList.remove('online');
        document.querySelector('.status-text').textContent = 'Demo Mode';
    }
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
        updateSidebarBadges(stats);
        
        // Update UI with real data
        if (agents.length > 0) {
            updateAgentsGrid(agents);
        }
        if (workflows.length > 0) {
            updateWorkflowsGrid(workflows);
        }
        if (channels.length > 0) {
            updateChannelsGrid(channels);
        }
        }
        if (sessions.length > 0) {
            document.getElementById('chatCount').textContent = `${sessions.length} sessions`;
        }
        if (skills.length > 0) {
            updateSkillsGrid(skills);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateAgentsGrid(agents) {
    const grid = document.querySelector('.agents-grid');
    if (!grid) return;
    
    grid.innerHTML = agents.slice(0, 6).map(agent => `
        <div class="agent-card">
            <div class="agent-avatar">${agent.icon || '🤖'}</div>
            <div class="agent-info">
                <h3>${agent.name}</h3>
                <p class="agent-division">${agent.division || 'Specialized'}</p>
                <p class="agent-specialty">${agent.specialty || agent.role || ''}</p>
            </div>
            <div class="agent-stats">
                <span class="stat-pill">${agent.tasks || 0} tasks</span>
            </div>
            <div class="agent-status ${agent.status === 'active' ? 'active' : 'paused'}"></div>
        </div>
    `).join('');
}

function updateWorkflowsGrid(workflows) {
    const grid = document.querySelector('.workflows-grid');
    if (!grid) return;
    
    grid.innerHTML = workflows.map(workflow => `
        <div class="workflow-card">
            <div class="workflow-header">
                <span class="workflow-icon">🔄</span>
                <span class="workflow-name">${workflow.name}</span>
                <span class="workflow-status ${workflow.status || 'draft'}">${workflow.status || 'Draft'}</span>
            </div>
            <p class="workflow-desc">${workflow.description || 'Workflow description'}</p>
            <div class="workflow-meta">
                <span>${workflow.agents || 1} agents</span>
                <span>•</span>
                <span>${workflow.lastRun || 'Not run yet'}</span>
            </div>
        </div>
    `).join('');
}

function updateSkillsGrid(skills) {
    const grid = document.querySelector('.skills-grid');
    if (!grid) return;
    
    grid.innerHTML = skills.slice(0, 8).map(skill => `
        <div class="skill-card enabled">
            <div class="skill-header">
                <span class="skill-icon">⚡</span>
                <span class="skill-name">${skill.title || skill.name}</span>
                <label class="skill-toggle">
                    <input type="checkbox" checked>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <p class="skill-desc">${skill.description || 'Skill description'}</p>
        </div>
    `).join('');
}

function updateChannelsGrid(channels) {
    const grid = document.querySelector('.channels-grid');
    if (!grid) return;
    
    const channelTypes = {
        discord: { icon: '💬', name: 'Discord' },
        telegram: { icon: '✈️', name: 'Telegram' },
        slack: { icon: '💼', name: 'Slack' },
        whatsapp: { icon: '📱', name: 'WhatsApp' },
        twitter: { icon: '🐦', name: 'Twitter/X' },
        email: { icon: '📧', name: 'Email' }
    };
    
    if (channels.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📱</span>
                <h3>No channels connected</h3>
                <p>Connect a messaging channel to get started</p>
                <button class="primary-btn" onclick="showAddChannelModal()">Add Channel</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = channels.map(ch => {
        const typeInfo = channelTypes[ch.type] || { icon: '📱', name: ch.type };
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
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">${content}</div>
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
            <div class="upload-icon">📁</div>
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
            showToast(`⚠️ ${ext.toUpperCase()} files cannot be processed by current AI models. Convert to text first.`, 'error');
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'upload-item';
        const icon = textTypes.includes(ext) ? '📝' : '📄';
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

console.log('🎼 Devora Dashboard loaded');
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

// ===== API Key Management (BYOK) =====
function saveApiKeys() {
    const keys = {
        openai: document.getElementById('openaiKey').value,
        anthropic: document.getElementById('anthropicKey').value,
        ollama: document.getElementById('ollamaUrl').value,
        deepseek: document.getElementById('deepseekKey').value
    };
    
    // Save to localStorage (BYOK pattern)
    localStorage.setItem('devora_api_keys', JSON.stringify(keys));
    
    // Also update the in-memory API config
    window.devoraApiKeys = keys;
    
    showToast('API keys saved locally!', 'success');
    console.log('Saved API keys:', Object.keys(keys).filter(k => keys[k]));
}

function loadApiKeys() {
    const saved = localStorage.getItem('devora_api_keys');
    if (saved) {
        const keys = JSON.parse(saved);
        window.devoraApiKeys = keys;
        
        if (keys.openai) document.getElementById('openaiKey').value = keys.openai;
        if (keys.anthropic) document.getElementById('anthropicKey').value = keys.anthropic;
        if (keys.ollama) document.getElementById('ollamaUrl').value = keys.ollama;
        if (keys.deepseek) document.getElementById('deepseekKey').value = keys.deepseek;
        
        console.log('Loaded API keys from localStorage');
    }
}

function toggleInternalKey() {
    const value = document.querySelector('.settings-group:nth-child(3) .setting-value');
    if (value.textContent === '••••••••••••') {
        value.textContent = 'agency-dev-key-change-in-production';
    } else {
        value.textContent = '••••••••••••';
    }
}

// Load API keys on init
loadApiKeys();

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

// ===== Button Event Listeners =====
setTimeout(() => {
    console.log('🎯 Setting up button handlers...');
    
    const addAgentBtn = document.getElementById('addAgentBtn');
    const addChannelBtn = document.getElementById('addChannelBtn');
    const addSkillBtn = document.getElementById('addSkillBtn');
    const uploadFilesNav = document.getElementById('uploadFilesNav');
    
    if (addAgentBtn) {
        addAgentBtn.onclick = function() { console.log('Agent clicked'); showAddAgentModal(); };
        console.log('✓ Add Agent button wired');
    } else {
        console.log('✕ Add Agent button not found');
    }
    
    if (addChannelBtn) {
        addChannelBtn.onclick = function() { console.log('Channel clicked'); showAddChannelModal(); };
        console.log('✓ Add Channel button wired');
    }
    
    if (addSkillBtn) {
        addSkillBtn.onclick = function() { console.log('Skill clicked'); showAddSkillModal(); };
        console.log('✓ Add Skill button wired');
    }
    
    if (uploadFilesNav) {
        uploadFilesNav.onclick = function() { console.log('Upload clicked'); showUploadModal(); };
        console.log('✓ Upload button wired');
    }
}, 500);