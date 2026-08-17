export interface AgentRecord {
  id: string;
  name: string;
  role: string;
  description: string;
  objective: string;
  systemPrompt: string;
  modelConnectionId: string | null;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  status: 'draft' | 'active' | 'disabled';
  permissions: {
    generateFlavor: boolean;
    generateStory: boolean;
    generateVisuals: boolean;
  };
  skillIds: string[];
  createdAt: string;
  updatedAt: string;
}

type AgentInput = Omit<AgentRecord, 'id' | 'skillIds' | 'createdAt' | 'updatedAt'>;

const API_URL = '/api/developer/agents';
const MODEL_API_URL = '/api/developer/api';

interface ModelConnection {
  id: string;
  accountId: string;
  name: string;
  provider: string;
  modelId: string;
}
const DEFAULT_AGENT: AgentInput = {
  name: '进化设计师',
  role: '负责精灵进化创意的游戏内容设计 Agent',
  description: '根据玩家描述，为固定进化路线创作名称、故事和外观表达。',
  objective: '在不修改战斗数值和技能成本的前提下，为三条合法进化路线生成清晰、有辨识度的创意内容。',
  systemPrompt: '你是一名全年龄游戏的精灵进化设计师。你只能创作名称、标签、故事引子和外观描述。不得修改属性、伤害、速度、技能成本、互斥关系或路线 ID。输出必须简洁、具体，并使用简体中文。',
  modelConnectionId: null,
  reasoningEffort: 'low',
  status: 'draft',
  permissions: { generateFlavor: true, generateStory: true, generateVisuals: true }
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char] ?? char));

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `请求失败（${response.status}）`);
  return data;
}

async function loadAgents() {
  return (await request<{ agents: AgentRecord[] }>(API_URL)).agents;
}

async function loadModels() {
  return (await request<{ connections: ModelConnection[] }>(MODEL_API_URL)).connections;
}

export async function refreshAgentCount() {
  try {
    const agents = await loadAgents();
    const count = document.querySelector<HTMLElement>('[data-agent-count]');
    const hint = document.querySelector<HTMLElement>('[data-agent-count-hint]');
    if (count) count.textContent = String(agents.length);
    if (hint) hint.textContent = agents.length ? `${agents.filter(agent => agent.status === 'active').length} 个已启用` : '等待创建';
  } catch {
    // The overview remains usable even when the local data service is restarting.
  }
}

export async function mountAgentManager(container: HTMLElement) {
  let agents: AgentRecord[] = [];
  let models: ModelConnection[] = [];
  container.innerHTML = managerShell('<div class="agent-loading"><i></i><span>正在读取本地 Agent 配置……</span></div>');

  try {
    [agents, models] = await Promise.all([loadAgents(), loadModels()]);
    renderList();
  } catch (error) {
    renderServiceError(error instanceof Error ? error.message : '无法连接本地配置服务');
  }

  container.onclick = event => {
    const actionTarget = (event.target as HTMLElement).closest<HTMLElement>('[data-agent-action]');
    if (!actionTarget) return;
    const action = actionTarget.dataset.agentAction;
    const id = actionTarget.dataset.agentId;
    if (action === 'new') renderEditor();
    if (action === 'cancel') renderList();
    if (action === 'edit' && id) renderEditor(agents.find(agent => agent.id === id));
    if (action === 'delete' && id) void deleteAgent(id);
    if (action === 'toggle' && id) void toggleAgent(id);
    if (action === 'retry') void reload();
  };

  container.onsubmit = event => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('#agent-editor')) return;
    event.preventDefault();
    void saveAgent(form);
  };

  async function reload() {
    container.innerHTML = managerShell('<div class="agent-loading"><i></i><span>正在重新连接……</span></div>');
    try {
      [agents, models] = await Promise.all([loadAgents(), loadModels()]);
      renderList();
    } catch (error) {
      renderServiceError(error instanceof Error ? error.message : '无法连接本地配置服务');
    }
  }

  function renderList() {
    const body = agents.length ? `
      <div class="agent-list">
        ${agents.map(agent => `
          <article class="agent-card">
            <div class="agent-card-top">
              <span class="agent-avatar">${escapeHtml(agent.name.slice(0, 1))}</span>
              <div class="agent-identity"><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.role)}</p></div>
              <span class="agent-status ${agent.status}">${statusLabel(agent.status)}</span>
            </div>
            <p class="agent-description">${escapeHtml(agent.description || '尚未填写简介')}</p>
            <div class="agent-meta">
              <span>模型 <strong>${escapeHtml(modelLabel(agent.modelConnectionId, models))}</strong></span>
              <span>推理 <strong>${effortLabel(agent.reasoningEffort)}</strong></span>
              <span>Skills <strong>${agent.skillIds.length}</strong></span>
              <span>更新 <strong>${formatDate(agent.updatedAt)}</strong></span>
            </div>
            <div class="agent-permissions">${permissionBadges(agent)}</div>
            <div class="agent-card-actions">
              <button class="table-button" type="button" data-agent-action="edit" data-agent-id="${agent.id}">编辑</button>
              <button class="table-button" type="button" data-agent-action="toggle" data-agent-id="${agent.id}">${agent.status === 'active' ? '停用' : '启用'}</button>
              <button class="table-button danger" type="button" data-agent-action="delete" data-agent-id="${agent.id}">删除</button>
            </div>
          </article>
        `).join('')}
      </div>
    ` : `
      <div class="agent-empty">
        <span class="empty-agent-mark">A</span>
        <h3>还没有 Agent</h3>
        <p>创建一个负责进化创意、剧情或战斗设计的 AI 角色。配置只会保存在本地项目中。</p>
        <button class="primary-button" type="button" data-agent-action="new">创建第一个 Agent</button>
      </div>
    `;
    container.innerHTML = managerShell(`
      <div class="agent-toolbar">
        <div><p class="eyebrow">AGENT LIBRARY</p><h3>Agent 列表 <span>${agents.length}</span></h3></div>
        <button class="primary-button" type="button" data-agent-action="new">+ 新建 Agent</button>
      </div>
      ${body}
    `, true);
  }

  function renderEditor(agent?: AgentRecord) {
    const value = agent ?? { ...DEFAULT_AGENT, modelConnectionId: models[0]?.id ?? null };
    container.innerHTML = managerShell(`
      <form id="agent-editor" class="agent-editor" data-agent-id="${agent?.id ?? ''}">
        <div class="editor-heading">
          <div><p class="eyebrow">${agent ? 'EDIT AGENT' : 'NEW AGENT'}</p><h3>${agent ? `编辑 ${escapeHtml(agent.name)}` : '创建 Agent'}</h3><p>定义角色定位、行为目标和允许生成的内容范围。</p></div>
          <div><button class="ghost-button" type="button" data-agent-action="cancel">取消</button><button class="primary-button" type="submit">保存 Agent</button></div>
        </div>
        <div class="form-message" data-form-message hidden></div>
        <div class="editor-grid">
          <section class="form-panel">
            <div class="form-section-title"><span>01</span><div><h4>基础信息</h4><p>帮助你在后台快速识别这个 Agent。</p></div></div>
            ${field('name', 'Agent 名称', value.name, '例如：进化设计师', 30)}
            ${field('role', '角色定位', value.role, '用一句话说明它负责什么', 50)}
            ${textarea('description', '简短介绍', value.description, '说明使用场景', 160, 3)}
          </section>
          <section class="form-panel">
            <div class="form-section-title"><span>02</span><div><h4>模型配置</h4><p>从“模型提供商”页面已经打开的模型中选择。</p></div></div>
            <label class="form-field"><span>模型<small>${models.length} 个可用</small></span><select name="modelConnectionId"${models.length ? '' : ' disabled'}>
              ${models.length ? models.map(model => modelOption(model, value.modelConnectionId)).join('') : '<option value="">请先打开一个模型</option>'}
            </select></label>
            ${models.length ? '' : '<div class="model-pool-notice"><span>模型池还是空的</span><button class="table-button" type="button" data-section="api">前往模型提供商</button></div>'}
            <label class="form-field"><span>推理强度</span><select name="reasoningEffort">
              ${selectOption('none', value.reasoningEffort, '无')}${selectOption('low', value.reasoningEffort, '低')}${selectOption('medium', value.reasoningEffort, '中')}${selectOption('high', value.reasoningEffort, '高')}
            </select></label>
            <label class="form-field"><span>状态</span><select name="status">
              ${selectOption('draft', value.status, '草稿')}${selectOption('active', value.status, '启用')}${selectOption('disabled', value.status, '停用')}
            </select></label>
          </section>
          <section class="form-panel wide">
            <div class="form-section-title"><span>03</span><div><h4>目标与系统提示词</h4><p>明确告诉 Agent 要完成什么，以及绝对不能改变什么。</p></div></div>
            ${textarea('objective', '核心目标', value.objective, '描述成功标准', 500, 4)}
            ${textarea('systemPrompt', '系统提示词', value.systemPrompt, '定义身份、工作方式和边界', 4000, 8)}
          </section>
          <section class="form-panel wide">
            <div class="form-section-title"><span>04</span><div><h4>允许生成的内容</h4><p>技能调用会在后续步骤中继续细化。</p></div></div>
            <div class="permission-grid">
              ${permission('generateFlavor', '名称与标签', '允许创作进化名称和短标签', value.permissions.generateFlavor)}
              ${permission('generateStory', '故事内容', '允许创作背景故事和剧情引子', value.permissions.generateStory)}
              ${permission('generateVisuals', '外观描述', '允许描述精灵外观和视觉特征', value.permissions.generateVisuals)}
            </div>
            <div class="safety-callout"><strong>规则引擎始终接管数值</strong><span>Agent 不能直接修改伤害、速度、技能成本、属性预算或互斥关系。</span></div>
          </section>
        </div>
      </form>
    `, true);
  }

  async function saveAgent(form: HTMLFormElement) {
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const message = form.querySelector<HTMLElement>('[data-form-message]')!;
    const formData = new FormData(form);
    const payload: AgentInput = {
      name: String(formData.get('name') ?? ''),
      role: String(formData.get('role') ?? ''),
      description: String(formData.get('description') ?? ''),
      objective: String(formData.get('objective') ?? ''),
      systemPrompt: String(formData.get('systemPrompt') ?? ''),
      modelConnectionId: formData.get('modelConnectionId') ? String(formData.get('modelConnectionId')) : null,
      reasoningEffort: String(formData.get('reasoningEffort')) as AgentInput['reasoningEffort'],
      status: String(formData.get('status')) as AgentInput['status'],
      permissions: {
        generateFlavor: formData.has('generateFlavor'),
        generateStory: formData.has('generateStory'),
        generateVisuals: formData.has('generateVisuals')
      }
    };
    const id = form.dataset.agentId;
    submit.disabled = true;
    submit.textContent = '保存中……';
    message.hidden = true;
    try {
      await request(id ? `${API_URL}/${id}` : API_URL, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      agents = await loadAgents();
      renderList();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : '保存失败';
      message.hidden = false;
      submit.disabled = false;
      submit.textContent = '保存 Agent';
    }
  }

  async function deleteAgent(id: string) {
    const agent = agents.find(item => item.id === id);
    if (!agent || !window.confirm(`确定删除“${agent.name}”吗？此操作不能撤销。`)) return;
    try {
      await request(`${API_URL}/${id}`, { method: 'DELETE' });
      agents = await loadAgents();
      renderList();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function toggleAgent(id: string) {
    const agent = agents.find(item => item.id === id);
    if (!agent) return;
    const { id: _id, skillIds: _skills, createdAt: _created, updatedAt: _updated, ...input } = agent;
    input.status = agent.status === 'active' ? 'disabled' : 'active';
    try {
      await request(`${API_URL}/${id}`, { method: 'PUT', body: JSON.stringify(input) });
      agents = await loadAgents();
      renderList();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '状态更新失败');
    }
  }

  function renderServiceError(message: string) {
    container.innerHTML = managerShell(`
      <div class="agent-empty error-state"><span class="empty-agent-mark">!</span><h3>本地配置服务暂不可用</h3><p>${escapeHtml(message)}</p><button class="ghost-button" type="button" data-agent-action="retry">重新连接</button></div>
    `);
  }
}

function managerShell(content: string, open = false) {
  return `
    <div class="section-shell agent-workspace">
      <div class="section-intro">
        <span class="large-icon agent-glyph">A</span>
        <div><p class="eyebrow">AGENTS WORKSPACE</p><h2>Agent 管理</h2><p>创建和管理负责进化、剧情与战斗设计的 AI 角色。</p></div>
        <span class="status-pill ${open ? 'available' : ''}">${open ? '本地功能已开放' : '正在连接'}</span>
      </div>
      <div class="agent-content">${content}</div>
    </div>
  `;
}

function field(name: string, label: string, value: string, placeholder: string, max: number) {
  return `<label class="form-field"><span>${label}</span><input name="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}" maxlength="${max}" required /></label>`;
}

function textarea(name: string, label: string, value: string, placeholder: string, max: number, rows: number) {
  return `<label class="form-field"><span>${label}<small>最多 ${max} 字</small></span><textarea name="${name}" placeholder="${placeholder}" maxlength="${max}" rows="${rows}" required>${escapeHtml(value)}</textarea></label>`;
}

function selectOption(value: string, selected: string, label: string) {
  return `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;
}

function modelOption(model: ModelConnection, selected: string | null) {
  return selectOption(model.id, selected ?? '', `${model.modelId} · ${providerLabel(model.provider)}`);
}

function modelLabel(id: string | null, models: ModelConnection[]) {
  if (!id) return '未选择';
  const model = models.find(item => item.id === id);
  return model ? `${model.modelId} · ${providerLabel(model.provider)}` : '模型已停用';
}

function providerLabel(provider: string) {
  return ({ openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', volcengine: '火山方舟', openrouter: 'OpenRouter', ollama: 'Ollama', 'openai-compatible': '兼容接口' } as Record<string, string>)[provider] ?? provider;
}

function permission(name: keyof AgentInput['permissions'], title: string, description: string, checked: boolean) {
  return `<label class="permission-option"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}/><span><strong>${title}</strong><small>${description}</small></span><i></i></label>`;
}

function statusLabel(status: AgentRecord['status']) {
  return status === 'active' ? '已启用' : status === 'disabled' ? '已停用' : '草稿';
}

function effortLabel(effort: AgentRecord['reasoningEffort']) {
  return { none: '无', low: '低', medium: '中', high: '高' }[effort];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function permissionBadges(agent: AgentRecord) {
  const labels = [
    agent.permissions.generateFlavor && '名称标签',
    agent.permissions.generateStory && '故事',
    agent.permissions.generateVisuals && '外观'
  ].filter(Boolean);
  return labels.length ? labels.map(label => `<span>${label}</span>`).join('') : '<span class="muted">未开放生成权限</span>';
}
