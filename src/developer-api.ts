interface ApiTestResult {
  status: 'success' | 'failed';
  checkedAt: string;
  message: string;
  latencyMs?: number;
}

type ApiProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'volcengine' | 'openrouter' | 'ollama' | 'openai-compatible';

interface ApiConnection {
  id: string;
  accountId: string;
  name: string;
  provider: ApiProvider;
  baseUrl: string;
  modelId: string;
  gatewayModelId: string;
  timeoutMs: number;
  enabled: boolean;
  lastTest: ApiTestResult | null;
}

interface ProviderAccount {
  id: string;
  name: string;
  provider: ApiProvider;
  baseUrl: string;
  requiresApiKey: boolean;
  catalog: Array<{ id: string; name: string; enabled: boolean }>;
  createdAt: string;
  updatedAt: string;
  lastDiscoveryAt: string | null;
  key: { configured: boolean; masked: string | null; source: 'local-file' | 'environment' | 'none' };
}

interface ApiStore {
  defaultConnectionId: string | null;
  fallbackConnectionIds: string[];
  accounts: ProviderAccount[];
  connections: ApiConnection[];
}

interface GatewayStatus {
  status: 'online' | 'offline';
  baseUrl: string;
  checkedAt: string;
  message: string;
  models: Array<{ id: string; ownedBy: string }>;
}

const API_URL = '/api/developer/api';
const PROVIDERS: Record<ApiProvider, { label: string; short: string; name: string; baseUrl: string; requiresApiKey: boolean }> = {
  openai: { label: 'OpenAI', short: 'OA', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', requiresApiKey: true },
  anthropic: { label: 'Claude', short: 'CL', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', requiresApiKey: true },
  gemini: { label: 'Gemini', short: 'GE', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com', requiresApiKey: true },
  deepseek: { label: 'DeepSeek', short: 'DS', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', requiresApiKey: true },
  volcengine: { label: '火山方舟', short: 'VE', name: '火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', requiresApiKey: true },
  openrouter: { label: 'OpenRouter', short: 'OR', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', requiresApiKey: true },
  ollama: { label: '本地 Ollama', short: 'OL', name: '本地 Ollama', baseUrl: 'http://127.0.0.1:11434', requiresApiKey: false },
  'openai-compatible': { label: 'OpenAI-Compatible', short: 'API', name: '自定义服务商', baseUrl: 'https://api.example.com/v1', requiresApiKey: true }
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character] ?? character));

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(data.error ?? `请求失败（${response.status}）`), { data });
  return data;
}

const loadStore = () => request<ApiStore>(API_URL);
const loadGateway = () => request<GatewayStatus>(`${API_URL}/gateway`);

export async function refreshApiStatus() {
  try {
    const [store, gateway] = await Promise.all([loadStore(), loadGateway()]);
    const primary = store.connections.find(connection => connection.id === store.defaultConnectionId);
    const label = document.querySelector<HTMLElement>('[data-api-status]');
    const hint = document.querySelector<HTMLElement>('[data-api-status-hint]');
    if (label) {
      label.textContent = gateway.status === 'online' ? `${store.accounts.length} 个提供商 · ${store.connections.length} 个模型` : '模型服务离线';
      label.classList.toggle('connected', gateway.status === 'online');
    }
    if (hint) hint.textContent = primary ? `默认：${primary.modelId}` : '还没有启用模型';
  } catch {
    // Keep the overview usable during local server restarts.
  }
}

export async function mountApiManager(container: HTMLElement) {
  let store: ApiStore = { defaultConnectionId: null, fallbackConnectionIds: [], accounts: [], connections: [] };
  let gateway: GatewayStatus = { status: 'offline', baseUrl: '', checkedAt: new Date().toISOString(), message: '正在连接', models: [] };
  const expandedAccounts = new Set<string>();
  let routeMode = false;

  container.innerHTML = managerShell('<div class="agent-loading"><i></i><span>正在读取模型提供商……</span></div>');
  try {
    [store, gateway] = await Promise.all([loadStore(), loadGateway()]);
    if (store.accounts[0]) expandedAccounts.add(store.accounts[0].id);
    render();
  } catch (error) {
    renderError(error instanceof Error ? error.message : '无法连接本地配置服务');
  }

  container.onclick = event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-provider-action]');
    if (!target) return;
    const action = target.dataset.providerAction;
    const id = target.dataset.accountId;
    if (action === 'choose-provider') {
      const form = target.closest<HTMLFormElement>('#provider-editor');
      const providerInput = form?.querySelector<HTMLInputElement>('input[name="provider"]');
      if (form && providerInput && target.dataset.providerId) {
        providerInput.value = target.dataset.providerId;
        void saveProvider(form);
      }
      return;
    }
    if (action === 'add') renderProviderEditor();
    if (action === 'add-volcengine') renderProviderEditor(undefined, 'volcengine');
    if (action === 'manage' && id) renderProviderEditor(store.accounts.find(account => account.id === id));
    if (action === 'manual' && id) renderManualModelEditor(store.accounts.find(account => account.id === id));
    if (action === 'cancel') render();
    if (action === 'expand' && id) { expandedAccounts.has(id) ? expandedAccounts.delete(id) : expandedAccounts.add(id); render(); }
    if (action === 'refresh' && id) void refreshProvider(id, target as HTMLButtonElement);
    if (action === 'delete' && id) void deleteProvider(id);
    if (action === 'routes') { routeMode = true; render(); }
    if (action === 'back') { routeMode = false; render(); }
    if (action === 'default' && id) void setDefault(id);
    if (action === 'fallback' && id) void toggleFallback(id);
    if (action === 'fallback-up' && id) void moveFallback(id, 'up');
    if (action === 'fallback-down' && id) void moveFallback(id, 'down');
    if (action === 'retry') void reload();
  };

  container.onchange = event => {
    const input = event.target as HTMLInputElement;
    if (input.matches('[data-provider-model]')) {
      void toggleModel(String(input.dataset.accountId), String(input.dataset.modelId), input.checked);
      return;
    }
    if (input.matches('input[name="noApiKey"]')) {
      const keyField = container.querySelector<HTMLElement>('[data-key-field]');
      const key = container.querySelector<HTMLInputElement>('input[name="apiKey"]');
      if (keyField) keyField.hidden = input.checked;
      if (key) key.required = !input.checked;
      return;
    }
  };

  container.oninput = event => {
    const input = event.target as HTMLInputElement;
    if (!input.matches('[data-provider-search]')) return;
    const query = input.value.trim().toLowerCase();
    container.querySelectorAll<HTMLElement>('[data-provider-card]').forEach(card => {
      card.hidden = Boolean(query) && !String(card.dataset.providerCard).toLowerCase().includes(query);
    });
  };

  container.onsubmit = event => {
    const form = event.target as HTMLFormElement;
    if (form.matches('#manual-model-editor')) {
      event.preventDefault();
      void saveManualModel(form);
      return;
    }
    if (!form.matches('#provider-editor')) return;
    event.preventDefault();
    void saveProvider(form);
  };

  async function reload() {
    try {
      [store, gateway] = await Promise.all([loadStore(), loadGateway()]);
      render();
    } catch (error) {
      renderError(error instanceof Error ? error.message : '无法连接本地配置服务');
    }
  }

  function render(message?: { type: 'success' | 'error'; text: string }) {
    const body = routeMode ? routeSettings(store) : providersPage(store, gateway, expandedAccounts);
    container.innerHTML = managerShell(`${message ? `<div class="api-message ${message.type}">${escapeHtml(message.text)}</div>` : ''}${body}`, true, gateway.status === 'online');
  }

  function renderProviderEditor(account?: ProviderAccount, initialProvider?: ApiProvider) {
    const provider = account?.provider ?? initialProvider ?? 'openai';
    const preset = PROVIDERS[provider];
    const requiresApiKey = account?.requiresApiKey ?? preset.requiresApiKey;
    const isDirectVolcengine = !account && initialProvider === 'volcengine';
    container.innerHTML = managerShell(`
      <form id="provider-editor" class="provider-editor" data-account-id="${account?.id ?? ''}" data-provider-direct="${isDirectVolcengine ? 'volcengine' : ''}">
        <div class="editor-heading"><div><p class="eyebrow">MODEL PROVIDER</p><h3>${account ? `管理 ${escapeHtml(account.name)} 凭据` : isDirectVolcengine ? '连接火山方舟' : '连接模型 API'}</h3><p>${account ? '更新凭据后会重新核验并刷新模型。' : isDirectVolcengine ? '已为你设置火山方舟国内节点，只需粘贴方舟 API Key。' : '直接粘贴 API Key，系统会识别服务商并读取可用模型。'}</p></div><div><button class="ghost-button" type="button" data-provider-action="cancel">取消</button><button class="primary-button" type="submit">${account ? '保存并刷新模型' : isDirectVolcengine ? '核验火山方舟' : '自动核验'}</button></div></div>
        <div class="form-message" data-form-message hidden></div>
        ${account ? `<div class="provider-selected"><i>${preset.short}</i><div><strong>${preset.label}</strong><p>当前已配置 ${account.key.masked ?? '无需密钥'}</p></div></div>` : isDirectVolcengine ? '<div class="provider-selected"><i>VE</i><div><strong>火山方舟</strong><p>国内节点 · Ark API v3</p></div></div>' : '<div class="auto-api-entry"><span>1</span><div><strong>粘贴 API Key</strong><small>本地识别服务商后，只向对应地址发送核验请求。</small></div></div>'}
        <input type="hidden" name="provider" value="${account || isDirectVolcengine ? provider : ''}">
        ${account ? `<input type="hidden" name="name" value="${escapeHtml(account.name)}">` : ''}
        <label class="form-field api-key-simple" data-key-field${!requiresApiKey ? ' hidden' : ''}><span>${account ? '替换 API Key' : isDirectVolcengine ? '火山方舟 API Key' : 'API Key'}<small>${account ? '留空则继续使用现有密钥' : '不会显示在页面或游戏代码中'}</small></span><input name="apiKey" type="password" autocomplete="new-password" placeholder="${account ? '无需修改可直接保存' : isDirectVolcengine ? '粘贴“API Key 管理”中的方舟密钥' : '在这里粘贴 API Key'}"></label>
        ${isDirectVolcengine ? '<div class="model-id-help"><strong>注意</strong><span>请使用“火山方舟 → API Key 管理”中的单个 API Key，不是访问控制页面里的 Access Key ID / Secret Access Key。</span></div>' : ''}
        ${account || isDirectVolcengine ? '' : '<div class="auto-provider-choice" data-auto-provider-choice hidden><div><strong>这个密钥格式无法唯一识别</strong><small>OpenAI、DeepSeek 和火山方舟都可能使用 sk- 开头，请确认来源后再核验。</small></div><button class="table-button" type="button" data-provider-action="choose-provider" data-provider-id="openai">OpenAI</button><button class="table-button" type="button" data-provider-action="choose-provider" data-provider-id="deepseek">DeepSeek</button><button class="table-button" type="button" data-provider-action="choose-provider" data-provider-id="volcengine">火山方舟</button></div>'}
        <details class="api-advanced-details"><summary>${account || isDirectVolcengine ? '高级设置' : 'API 地址或本地模型（可选）'}</summary><div><label class="form-field"><span>Base URL<small>${account || isDirectVolcengine ? '' : '不填写时根据识别结果自动补全'}</small></span><input name="baseUrl" value="${escapeHtml(account?.baseUrl ?? (isDirectVolcengine ? preset.baseUrl : ''))}" placeholder="例如：https://api.example.com/v1"${account || isDirectVolcengine ? ' required' : ''}></label>${account || isDirectVolcengine ? '' : '<label class="permission-option compact-permission" data-no-auth-field><input type="checkbox" name="noApiKey"><span><strong>这个接口不需要 API Key</strong><small>适用于 Ollama、本地或内网模型服务。</small></span><i></i></label>'}</div></details>
        ${account ? `<div class="provider-danger-zone"><span><strong>删除模型提供商</strong><small>同时移除该提供商下的已启用模型。</small></span><button class="table-button danger" type="button" data-provider-action="delete" data-account-id="${account.id}">删除提供商</button></div>` : ''}
      </form>
    `, true, gateway.status === 'online');
  }

  function renderManualModelEditor(account?: ProviderAccount) {
    if (!account) {
      render({ type: 'error', text: '没有找到这个模型提供商。' });
      return;
    }
    const preset = PROVIDERS[account.provider];
    const isVolcengine = account.provider === 'volcengine';
    container.innerHTML = managerShell(`
      <form id="manual-model-editor" class="provider-editor" data-account-id="${account.id}">
        <div class="editor-heading"><div><p class="eyebrow">ADD MODEL</p><h3>${isVolcengine ? '添加火山方舟模型' : `添加 ${escapeHtml(account.name)} 模型`}</h3><p>${isVolcengine ? '填写控制台中的模型 ID，或已部署的推理接入点 Endpoint ID。' : '当服务商不能自动返回模型列表时，可以手动添加模型 ID。'}</p></div><div><button class="ghost-button" type="button" data-provider-action="cancel">取消</button><button class="primary-button" type="submit">添加到模型池</button></div></div>
        <div class="form-message" data-form-message hidden></div>
        <div class="provider-selected"><i>${preset.short}</i><div><strong>${escapeHtml(account.name)}</strong><p>凭据已配置 · ${escapeHtml(account.baseUrl)}</p></div></div>
        <label class="form-field api-key-simple"><span>${isVolcengine ? '模型 ID / Endpoint ID' : '模型 ID'}<small>${isVolcengine ? '例如 doubao-seed-… 或 ep-…' : '请与服务商控制台保持一致'}</small></span><input name="modelId" autocomplete="off" placeholder="${isVolcengine ? '粘贴模型 ID 或 Endpoint ID' : '输入模型 ID'}" maxlength="120" required></label>
        ${isVolcengine ? '<div class="model-id-help"><strong>在哪里找？</strong><span>基础模型可在火山方舟“开通管理”中复制模型 ID；已部署模型可在“在线推理”中复制 Endpoint ID。</span></div>' : ''}
      </form>
    `, true, gateway.status === 'online');
  }

  async function saveProvider(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = form.dataset.accountId;
    const existing = id ? store.accounts.find(account => account.id === id) : undefined;
    const apiKey = String(data.get('apiKey') || '').trim();
    const enteredBaseUrl = String(data.get('baseUrl') || '').trim();
    const message = form.querySelector<HTMLElement>('[data-form-message]')!;
    const choice = form.querySelector<HTMLElement>('[data-auto-provider-choice]');
    let provider = String(data.get('provider') || '') as ApiProvider | '';
    if (!provider) {
      const detection = detectProvider(apiKey, enteredBaseUrl);
      if (detection.candidates) {
        message.textContent = '需要确认一次密钥来源，确认后系统才会发送核验请求。';
        message.hidden = false;
        if (choice) choice.hidden = false;
        return;
      }
      if (!detection.provider) {
        message.textContent = detection.error ?? '暂时无法识别，请在高级设置中填写 API 地址。';
        message.hidden = false;
        return;
      }
      provider = detection.provider;
    }
    const preset = PROVIDERS[provider];
    const requiresApiKey = existing?.requiresApiKey ?? (preset.requiresApiKey && !data.has('noApiKey'));
    if (requiresApiKey && !apiKey && !existing?.key.configured) {
      message.textContent = '请粘贴 API Key；如果是本地模型，请填写 API 地址并勾选“不需要 API Key”。';
      message.hidden = false;
      return;
    }
    const payload = {
      name: String(data.get('name') || preset.name), provider,
      baseUrl: enteredBaseUrl || preset.baseUrl,
      requiresApiKey,
      ...(apiKey ? { apiKey } : {})
    };
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    if (choice) choice.hidden = true;
    submit.disabled = true;
    submit.textContent = '正在验证并读取模型……';
    try {
      store = await request<ApiStore>(id ? `${API_URL}/providers/${id}` : `${API_URL}/providers`, {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
      });
      if (!id && store.accounts[0]) expandedAccounts.add(store.accounts[0].id);
      gateway = await loadGateway();
      render({ type: 'success', text: '提供商已配置，打开模型开关后即可在 Agent 中选择。' });
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : '提供商配置失败';
      message.hidden = false;
      submit.disabled = false;
      submit.textContent = id ? '保存并刷新模型' : form.dataset.providerDirect === 'volcengine' ? '核验火山方舟' : '自动核验';
    }
  }

  async function saveManualModel(form: HTMLFormElement) {
    const accountId = String(form.dataset.accountId || '');
    const modelId = String(new FormData(form).get('modelId') || '').trim();
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const message = form.querySelector<HTMLElement>('[data-form-message]')!;
    submit.disabled = true;
    submit.textContent = '正在加入模型池……';
    try {
      store = await request<ApiStore>(`${API_URL}/providers/${accountId}/models`, {
        method: 'POST', body: JSON.stringify({ modelId, enabled: true })
      });
      expandedAccounts.add(accountId);
      gateway = await loadGateway();
      render({ type: 'success', text: `${modelId} 已加入模型池，可以在 Agent 中选择。` });
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : '模型添加失败';
      message.hidden = false;
      submit.disabled = false;
      submit.textContent = '添加到模型池';
    }
  }

  async function refreshProvider(id: string, button: HTMLButtonElement) {
    button.disabled = true;
    button.textContent = '刷新中……';
    try {
      store = await request<ApiStore>(`${API_URL}/providers/${id}/refresh`, { method: 'POST', body: '{}' });
      render({ type: 'success', text: '可用模型列表已更新。' });
    } catch (error) {
      render({ type: 'error', text: error instanceof Error ? error.message : '刷新失败' });
    }
  }

  async function toggleModel(accountId: string, modelId: string, enabled: boolean) {
    try {
      store = await request<ApiStore>(`${API_URL}/providers/${accountId}/models`, { method: 'POST', body: JSON.stringify({ modelId, enabled }) });
      gateway = await loadGateway();
      render({ type: 'success', text: enabled ? `${modelId} 已加入模型池。` : `${modelId} 已从模型池移除。` });
    } catch (error) {
      render({ type: 'error', text: error instanceof Error ? error.message : '模型状态更新失败' });
    }
  }

  async function deleteProvider(id: string) {
    const account = store.accounts.find(item => item.id === id);
    if (!account || !window.confirm(`确定删除模型提供商“${account.name}”吗？`)) return;
    try {
      store = await request<ApiStore>(`${API_URL}/providers/${id}`, { method: 'DELETE' });
      gateway = await loadGateway();
      render({ type: 'success', text: '模型提供商及其模型已删除。' });
    } catch (error) {
      render({ type: 'error', text: error instanceof Error ? error.message : '删除失败' });
    }
  }

  async function setDefault(id: string) {
    try { store = await request<ApiStore>(`${API_URL}/${id}/default`, { method: 'POST', body: '{}' }); render({ type: 'success', text: '默认模型已更新。' }); }
    catch (error) { render({ type: 'error', text: error instanceof Error ? error.message : '设置失败' }); }
  }

  async function toggleFallback(id: string) {
    try { store = await request<ApiStore>(`${API_URL}/${id}/fallback`, { method: 'POST', body: '{}' }); render({ type: 'success', text: '备用模型顺序已更新。' }); }
    catch (error) { render({ type: 'error', text: error instanceof Error ? error.message : '更新失败' }); }
  }

  async function moveFallback(id: string, direction: 'up' | 'down') {
    try { store = await request<ApiStore>(`${API_URL}/${id}/fallback-${direction}`, { method: 'POST', body: '{}' }); render({ type: 'success', text: '备用模型顺序已更新。' }); }
    catch (error) { render({ type: 'error', text: error instanceof Error ? error.message : '排序失败' }); }
  }

  function renderError(message: string) {
    container.innerHTML = managerShell(`<div class="agent-empty error-state"><span class="empty-agent-mark">!</span><h3>模型提供商服务暂不可用</h3><p>${escapeHtml(message)}</p><button class="ghost-button" data-provider-action="retry">重新连接</button></div>`);
  }
}

function detectProvider(apiKey: string, baseUrl: string): { provider?: ApiProvider; candidates?: ApiProvider[]; error?: string } {
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      const host = url.hostname.toLowerCase();
      if (host === 'api.openai.com') return { provider: 'openai' };
      if (host === 'api.anthropic.com') return { provider: 'anthropic' };
      if (host === 'generativelanguage.googleapis.com') return { provider: 'gemini' };
      if (host === 'api.deepseek.com') return { provider: 'deepseek' };
      if (host.startsWith('ark.') && host.endsWith('.volces.com')) return { provider: 'volcengine' };
      if (host === 'openrouter.ai') return { provider: 'openrouter' };
      if ((host === '127.0.0.1' || host === 'localhost') && (url.port === '11434' || url.pathname.startsWith('/api'))) return { provider: 'ollama' };
      return { provider: 'openai-compatible' };
    } catch {
      return { error: 'API 地址格式不正确，请填写以 http:// 或 https:// 开头的完整地址。' };
    }
  }
  if (apiKey.startsWith('sk-ant-')) return { provider: 'anthropic' };
  if (apiKey.startsWith('sk-or-')) return { provider: 'openrouter' };
  if (apiKey.startsWith('AIza')) return { provider: 'gemini' };
  if (apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-svcacct-')) return { provider: 'openai' };
  if (apiKey.startsWith('sk-')) return { candidates: ['openai', 'deepseek', 'volcengine'] };
  if (!apiKey) return { error: '请粘贴 API Key，或者在高级设置中填写本地模型的 API 地址。' };
  return { error: '无法只根据这个密钥格式判断服务商，请在高级设置中填写 API 地址。' };
}

function managerShell(content: string, open = false, online = false) {
  return `<div class="section-shell agent-workspace api-workspace"><div class="section-intro"><span class="large-icon api-glyph">⌁</span><div><p class="eyebrow">MODEL PROVIDERS</p><h2>模型提供商</h2><p>统一配置服务商凭据，并把需要的模型加入 Agent 可用模型池。</p></div><span class="status-pill ${online ? 'available' : ''}">${open ? online ? '模型服务正常' : '模型服务离线' : '正在连接'}</span></div><div class="agent-content">${content}</div></div>`;
}

function providersPage(store: ApiStore, gateway: GatewayStatus, expanded: Set<string>) {
  return `<div class="provider-page-toolbar"><label><span>⌕</span><input data-provider-search placeholder="搜索提供商或模型"></label><div><button class="ghost-button" data-provider-action="routes">默认模型设置</button><button class="volcengine-button" data-provider-action="add-volcengine"><span>VE</span> 连接火山方舟</button><button class="primary-button" data-provider-action="add">+ 添加其他模型 API</button></div></div><div class="provider-summary"><span><small>已配置提供商</small><strong>${store.accounts.length}</strong></span><span><small>模型池</small><strong>${store.connections.length}</strong></span><span><small>网关状态</small><strong class="${gateway.status}">${gateway.status === 'online' ? '正常' : '离线'}</strong></span></div><div class="provider-card-list">${store.accounts.map(account => providerCard(account, store, expanded.has(account.id))).join('') || `<div class="agent-empty api-empty simple"><span class="empty-agent-mark api-connection-avatar">+</span><h3>还没有模型提供商</h3><p>连接火山方舟，或者添加其他模型 API。</p><div class="empty-provider-actions"><button class="volcengine-button" data-provider-action="add-volcengine"><span>VE</span> 连接火山方舟</button><button class="primary-button" data-provider-action="add">添加其他模型 API</button></div></div>`}</div>`;
}

function providerCard(account: ProviderAccount, store: ApiStore, open: boolean) {
  const preset = PROVIDERS[account.provider];
  const isVolcengine = account.provider === 'volcengine';
  const searchable = `${account.name} ${preset.label} ${account.catalog.map(model => `${model.id} ${model.name}`).join(' ')}`;
  return `<article class="provider-account-card" data-provider-card="${escapeHtml(searchable)}"><div class="provider-account-head"><span class="provider-account-logo">${preset.short}</span><div class="provider-account-title"><h3>${escapeHtml(account.name)}</h3><p><em>LLM</em><em>CHAT</em> · ${account.catalog.length} 个模型</p></div><button class="table-button" data-provider-action="manual" data-account-id="${account.id}">+ 添加模型</button><button class="table-button" data-provider-action="refresh" data-account-id="${account.id}">${isVolcengine ? '核验凭据' : '刷新模型'}</button><span class="provider-credential"><i></i><small>API KEY</small><strong>${account.key.configured ? '已配置' : account.requiresApiKey ? '未配置' : '无需密钥'}</strong><button data-provider-action="manage" data-account-id="${account.id}">管理凭据</button></span></div><button class="provider-model-toggle" data-provider-action="expand" data-account-id="${account.id}"><span>${open ? '收起模型' : '显示模型'} (${account.catalog.length})</span><i>${open ? '⌃' : '⌄'}</i></button>${open ? `<div class="provider-model-list">${account.catalog.map(model => providerModelRow(account, model, store)).join('') || `<p>${isVolcengine ? '凭据已经配置，请点击“添加模型”填写模型 ID 或 Endpoint ID。' : '没有读取到模型，可以刷新列表或手动添加。'}</p>`}</div>` : ''}</article>`;
}

function providerModelRow(account: ProviderAccount, model: ProviderAccount['catalog'][number], store: ApiStore) {
  const connection = store.connections.find(item => item.accountId === account.id && item.modelId === model.id);
  const isDefault = connection?.id === store.defaultConnectionId;
  return `<label class="provider-model-row"><span class="provider-model-icon">${PROVIDERS[account.provider].short}</span><span><strong>${escapeHtml(model.name || model.id)}</strong><small>${escapeHtml(model.id)}</small></span><em>LLM</em><em>CHAT</em>${isDefault ? '<b>默认</b>' : ''}<input type="checkbox" data-provider-model data-account-id="${account.id}" data-model-id="${escapeHtml(model.id)}"${model.enabled ? ' checked' : ''}><i></i></label>`;
}

function routeSettings(store: ApiStore) {
  const primary = store.connections.find(connection => connection.id === store.defaultConnectionId);
  const fallbacks = store.fallbackConnectionIds.map(id => store.connections.find(connection => connection.id === id)).filter((connection): connection is ApiConnection => Boolean(connection));
  const used = new Set([store.defaultConnectionId, ...store.fallbackConnectionIds]);
  const unused = store.connections.filter(connection => !used.has(connection.id));
  return `<div class="simple-section-heading route-heading"><div><p class="eyebrow">DEFAULT MODEL</p><h3>默认模型设置</h3><p>这里决定游戏默认使用哪个模型，以及失败后的备用顺序。</p></div><button class="ghost-button" data-provider-action="back">← 返回模型提供商</button></div><div class="simple-route-list">${primary ? routeRow(primary, '默认模型', -1, fallbacks.length) : '<p class="routing-empty">请先在模型提供商中打开一个模型。</p>'}${fallbacks.map((connection, index) => routeRow(connection, `备用 #${index + 1}`, index, fallbacks.length)).join('')}</div>${unused.length ? `<div class="unused-models"><h4>模型池中的其他模型</h4>${unused.map(connection => `<div><span><strong>${escapeHtml(connection.modelId)}</strong><small>${escapeHtml(PROVIDERS[connection.provider].label)}</small></span><button class="table-button" data-provider-action="default" data-account-id="${connection.id}">设为默认</button><button class="table-button" data-provider-action="fallback" data-account-id="${connection.id}">加入备用</button></div>`).join('')}</div>` : ''}`;
}

function routeRow(connection: ApiConnection, role: string, index: number, count: number) {
  const primary = index < 0;
  return `<div class="simple-route-item ${primary ? 'primary' : ''}"><span class="route-number">${primary ? '主' : index + 1}</span><div><strong>${escapeHtml(connection.modelId)}</strong><small>${escapeHtml(PROVIDERS[connection.provider].label)}</small></div><em>${role}</em>${primary ? '' : `<button class="table-button" data-provider-action="fallback-up" data-account-id="${connection.id}"${index === 0 ? ' disabled' : ''}>上移</button><button class="table-button" data-provider-action="fallback-down" data-account-id="${connection.id}"${index === count - 1 ? ' disabled' : ''}>下移</button><button class="table-button" data-provider-action="fallback" data-account-id="${connection.id}">移出</button>`}</div>`;
}
