import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const providerSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'volcengine',
  'openrouter',
  'ollama',
  'openai-compatible'
]);

const connectionInputSchema = z.object({
  name: z.string().trim().min(2, '连接名称至少需要 2 个字').max(40, '连接名称不能超过 40 个字'),
  protocol: z.literal('openai-compatible'),
  provider: providerSchema.default('openai-compatible'),
  baseUrl: z.string().trim().url('请输入完整的 API 地址，例如 https://example.com/v1')
    .refine(value => value.startsWith('http://') || value.startsWith('https://'), 'API 地址必须使用 http 或 https'),
  modelId: z.string().trim().min(1, '请填写模型 ID').max(120, '模型 ID 不能超过 120 个字符'),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']),
  timeoutMs: z.number().int().min(5_000, '超时时间不能低于 5 秒').max(120_000, '超时时间不能超过 120 秒'),
  enabled: z.boolean(),
  requiresApiKey: z.boolean()
});

const testResultSchema = z.object({
  status: z.enum(['success', 'failed']),
  checkedAt: z.string().datetime(),
  message: z.string(),
  latencyMs: z.number().int().nonnegative().optional()
});

const storedConnectionSchema = connectionInputSchema.extend({
  id: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastTest: testResultSchema.nullable()
});

const catalogModelSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(160).default('')
});

const storedAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(40),
  provider: providerSchema,
  baseUrl: connectionInputSchema.shape.baseUrl,
  requiresApiKey: z.boolean(),
  catalog: z.array(catalogModelSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastDiscoveryAt: z.string().datetime().nullable().default(null)
});

const storeSchema = z.object({
  defaultConnectionId: z.string().uuid().nullable(),
  fallbackConnectionIds: z.array(z.string().uuid()).default([]),
  accounts: z.array(storedAccountSchema).default([]),
  connections: z.array(storedConnectionSchema)
});

const saveRequestSchema = connectionInputSchema.extend({
  apiKey: z.string().trim().max(500, 'API Key 不能超过 500 个字符').optional()
});

const discoverRequestSchema = z.object({
  provider: providerSchema,
  baseUrl: connectionInputSchema.shape.baseUrl,
  requiresApiKey: z.boolean(),
  apiKey: z.string().trim().max(500).optional(),
  accountId: z.string().uuid().optional(),
  sourceConnectionId: z.string().uuid().optional()
});

const accountRequestSchema = discoverRequestSchema.extend({
  name: z.string().trim().min(2, '服务商名称至少需要 2 个字').max(40),
  modelIds: z.array(z.string().trim().min(1).max(120)).min(1, '请至少选择一个模型').max(50, '一次最多添加 50 个模型')
});

const providerRequestSchema = z.object({
  name: z.string().trim().min(2, '服务商名称至少需要 2 个字').max(40),
  provider: providerSchema,
  baseUrl: connectionInputSchema.shape.baseUrl,
  requiresApiKey: z.boolean(),
  apiKey: z.string().trim().max(500).optional()
});

const modelToggleSchema = z.object({
  modelId: z.string().trim().min(1).max(120),
  enabled: z.boolean()
});

type StoredConnection = z.infer<typeof storedConnectionSchema>;
type StoredAccount = z.infer<typeof storedAccountSchema>;
type ConnectionStore = z.infer<typeof storeSchema>;

const SETTINGS_FILE = resolve(process.cwd(), 'developer-data/api-settings.json');
const ENV_FILE = resolve(process.cwd(), 'developer-data/api-secrets.local');
const LITELLM_SECRET_FILE = resolve(process.cwd(), 'developer-data/litellm-secrets.local');
const LITELLM_CONFIG_FILE = resolve(process.cwd(), 'developer-data/litellm-config.local.yaml');
const EMPTY_STORE: ConnectionStore = { defaultConnectionId: null, fallbackConnectionIds: [], accounts: [], connections: [] };
let startupOpenAiKey = '';

export function setStartupApiKey(apiKey: string | undefined) {
  startupOpenAiKey = apiKey?.trim() ?? '';
}

async function readStore(): Promise<ConnectionStore> {
  try {
    const parsed = JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) as unknown;
    return ensureAccounts(storeSchema.parse(parsed));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_STORE, fallbackConnectionIds: [], accounts: [], connections: [] };
    throw error;
  }
}

async function writeStore(store: ConnectionStore) {
  await mkdir(dirname(SETTINGS_FILE), { recursive: true });
  const tempFile = `${SETTINGS_FILE}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(tempFile, SETTINGS_FILE);
}

async function readEnvFile() {
  try {
    return await readFile(ENV_FILE, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

function readEnvValue(contents: string, name: string) {
  const line = contents.split(/\r?\n/).find(candidate => candidate.trimStart().startsWith(`${name}=`));
  if (!line) return '';
  const value = line.slice(line.indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

function secretName(connectionId: string) {
  return `MODEL_API_KEY_${connectionId.replaceAll('-', '_').toUpperCase()}`;
}

function credentialId(connection: StoredConnection) {
  return connection.accountId ?? connection.id;
}

function ensureAccounts(store: ConnectionStore) {
  for (const connection of store.connections) {
    const id = credentialId(connection);
    let account = store.accounts.find(candidate => candidate.id === id);
    if (!account) {
      account = {
        id,
        name: connection.name,
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        requiresApiKey: connection.requiresApiKey,
        catalog: [],
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        lastDiscoveryAt: null
      };
      store.accounts.push(account);
    }
    if (!account.catalog.some(model => model.id === connection.modelId)) {
      account.catalog.push({ id: connection.modelId, name: '' });
    }
  }
  return store;
}

async function resolveAccountSecret(account: StoredAccount) {
  const localKey = readEnvValue(await readEnvFile(), secretName(account.id));
  if (localKey) return { value: localKey, source: 'local-file' as const };
  const isOpenAi = normalizeBaseUrl(account.baseUrl) === 'https://api.openai.com/v1';
  if (isOpenAi && startupOpenAiKey) return { value: startupOpenAiKey, source: 'environment' as const };
  return { value: '', source: 'none' as const };
}

async function resolveSecret(connection: StoredConnection) {
  const localKey = readEnvValue(await readEnvFile(), secretName(credentialId(connection)));
  if (localKey) return { value: localKey, source: 'local-file' as const };
  const isOpenAi = normalizeBaseUrl(connection.baseUrl) === 'https://api.openai.com/v1';
  if (isOpenAi && startupOpenAiKey) return { value: startupOpenAiKey, source: 'environment' as const };
  return { value: '', source: 'none' as const };
}

async function updateEnvValue(name: string, value: string | null) {
  const current = await readEnvFile();
  const lines = current.split(/\r?\n/).filter((line, index, all) => !(index === all.length - 1 && !line));
  const index = lines.findIndex(line => line.trimStart().startsWith(`${name}=`));
  if (value === null) {
    if (index >= 0) lines.splice(index, 1);
  } else {
    const nextLine = `${name}=${value.replace(/[\r\n]/g, '')}`;
    if (index >= 0) lines[index] = nextLine;
    else lines.push(nextLine);
  }
  const next = lines.length ? `${lines.join('\n')}\n` : '';
  const tempFile = `${ENV_FILE}.tmp`;
  await writeFile(tempFile, next, { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, ENV_FILE);
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function providerModel(connection: StoredConnection) {
  const prefix = connection.provider === 'openai-compatible' ? 'openai' : connection.provider;
  return `${prefix}/${connection.modelId}`;
}

function gatewayModelName(connection: StoredConnection) {
  return `${connection.modelId}--${connection.id.slice(0, 8)}`;
}

function normalizeRouting(store: ConnectionStore) {
  const enabledIds = new Set(store.connections.filter(connection => connection.enabled).map(connection => connection.id));
  if (!store.defaultConnectionId || !enabledIds.has(store.defaultConnectionId)) {
    store.defaultConnectionId = store.connections.find(connection => connection.enabled)?.id ?? null;
  }
  store.fallbackConnectionIds = [...new Set(store.fallbackConnectionIds)]
    .filter(id => enabledIds.has(id) && id !== store.defaultConnectionId);
  return store;
}

async function gatewayConfig(store: ConnectionStore) {
  const usable = [];
  for (const connection of store.connections) {
    if (!connection.enabled) continue;
    const key = await resolveSecret(connection);
    if (connection.requiresApiKey && !key.value) continue;
    usable.push({ connection, apiKey: key.value });
  }

  const models = usable.map(({ connection, apiKey }) => {
    const lines = [
      `  - model_name: ${yamlString(gatewayModelName(connection))}`,
      '    litellm_params:',
      `      model: ${yamlString(providerModel(connection))}`,
      `      api_base: ${yamlString(normalizeBaseUrl(connection.baseUrl))}`,
      `      timeout: ${Math.ceil(connection.timeoutMs / 1000)}`
    ];
    if (apiKey) lines.push(`      api_key: ${yamlString(apiKey)}`);
    lines.push(
      '    model_info:',
      `      id: ${yamlString(connection.id)}`,
      `      provider: ${yamlString(connection.provider)}`
    );
    return lines.join('\n');
  });
  const usableIds = new Set(usable.map(({ connection }) => connection.id));
  const primary = store.connections.find(connection => connection.id === store.defaultConnectionId && usableIds.has(connection.id));
  const fallbacks = store.fallbackConnectionIds
    .map(id => store.connections.find(connection => connection.id === id && usableIds.has(connection.id)))
    .filter((connection): connection is StoredConnection => Boolean(connection));
  const fallbackLines = primary && fallbacks.length
    ? [`  fallbacks:`, `    - ${yamlString(gatewayModelName(primary))}:`, ...fallbacks.map(connection => `        - ${yamlString(gatewayModelName(connection))}`)]
    : ['  fallbacks: []'];

  return [
    '# Generated by the GRAVEHORDE developer console.',
    '# Contains local secrets. Never commit this file.',
    models.length ? `model_list:\n${models.join('\n')}` : 'model_list: []',
    '',
    'litellm_settings:',
    '  drop_params: true',
    '  num_retries: 2',
    '  request_timeout: 60',
    '  telemetry: false',
    '',
    'router_settings:',
    '  routing_strategy: simple-shuffle',
    '  num_retries: 2',
    '  timeout: 60',
    ...fallbackLines,
    '',
    'general_settings:',
    '  master_key: os.environ/LITELLM_MASTER_KEY',
    ...(primary ? [`  completion_model: ${yamlString(gatewayModelName(primary))}`] : []),
    ''
  ].join('\n');
}

async function syncGatewayConfig(store: ConnectionStore) {
  const next = await gatewayConfig(store);
  try {
    if (await readFile(LITELLM_CONFIG_FILE, 'utf8') === next) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const tempFile = `${LITELLM_CONFIG_FILE}.tmp`;
  await writeFile(tempFile, next, { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, LITELLM_CONFIG_FILE);
}

async function gatewayConnection() {
  const secrets = await readFile(LITELLM_SECRET_FILE, 'utf8');
  const masterKey = readEnvValue(secrets, 'LITELLM_MASTER_KEY');
  const port = readEnvValue(secrets, 'LITELLM_PORT') || '4000';
  return { masterKey, baseUrl: `http://127.0.0.1:${port}` };
}

async function getGatewayStatus() {
  const checkedAt = new Date().toISOString();
  try {
    const { masterKey, baseUrl } = await gatewayConnection();
    if (!masterKey) throw new Error('本机网关密钥尚未配置');
    const upstream = await fetch(`${baseUrl}/v1/models`, {
      headers: { authorization: `Bearer ${masterKey}` },
      signal: AbortSignal.timeout(4_000)
    });
    if (!upstream.ok) throw new Error(`网关返回 HTTP ${upstream.status}`);
    const payload = await upstream.json() as { data?: Array<{ id?: unknown; owned_by?: unknown }> };
    const models = (payload.data ?? [])
      .filter(model => typeof model.id === 'string')
      .map(model => ({
        id: model.id as string,
        ownedBy: typeof model.owned_by === 'string' ? model.owned_by : 'LiteLLM'
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      status: 'online' as const,
      baseUrl,
      checkedAt,
      message: models.length ? `已读取 ${models.length} 个模型` : '网关在线，尚未载入模型',
      models
    };
  } catch (error) {
    return {
      status: 'offline' as const,
      baseUrl: 'http://127.0.0.1:4000',
      checkedAt,
      message: error instanceof Error ? error.message : '无法连接 LiteLLM 网关',
      models: []
    };
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('请求内容过大');
  }
  return JSON.parse(raw || '{}') as unknown;
}

function json(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(payload));
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function maskedKey(key: string) {
  return key.length > 4 ? `••••••••${key.slice(-4)}` : '••••••••';
}

function modelsEndpoint(provider: z.infer<typeof providerSchema>, baseUrl: string) {
  const base = normalizeBaseUrl(baseUrl);
  if (provider === 'ollama') return `${base}/api/tags`;
  if (provider === 'anthropic') return base.endsWith('/v1') ? `${base}/models?limit=1000` : `${base}/v1/models?limit=1000`;
  if (provider === 'gemini') {
    if (base.includes('/v1beta/openai')) return `${base}/models`;
    return `${base}/v1beta/models?pageSize=1000`;
  }
  return `${base}/models`;
}

function upstreamError(payload: unknown, status: number) {
  const message = (payload as { error?: { message?: unknown } | unknown; message?: unknown }).error;
  if (typeof message === 'object' && message && 'message' in message && typeof message.message === 'string') return message.message;
  if (typeof message === 'string') return message;
  const direct = (payload as { message?: unknown }).message;
  return typeof direct === 'string' ? direct : connectionErrorMessage(status);
}

function modelCatalog(provider: z.infer<typeof providerSchema>, payload: unknown) {
  if (provider === 'ollama') {
    return ((payload as { models?: Array<{ model?: unknown; name?: unknown }> }).models ?? [])
      .map(model => ({ id: typeof model.model === 'string' ? model.model : typeof model.name === 'string' ? model.name : '', name: typeof model.name === 'string' ? model.name : '' }));
  }
  if (provider === 'gemini' && Array.isArray((payload as { models?: unknown }).models)) {
    return ((payload as { models: Array<{ name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }> }).models)
      .filter(model => !Array.isArray(model.supportedGenerationMethods) || model.supportedGenerationMethods.includes('generateContent'))
      .map(model => ({
        id: typeof model.name === 'string' ? model.name.replace(/^models\//, '') : '',
        name: typeof model.displayName === 'string' ? model.displayName : ''
      }));
  }
  return ((payload as { data?: Array<{ id?: unknown; name?: unknown; display_name?: unknown }> }).data ?? [])
    .map(model => ({
      id: typeof model.id === 'string' ? model.id : '',
      name: typeof model.name === 'string' ? model.name : typeof model.display_name === 'string' ? model.display_name : ''
    }));
}

async function discoverModels(input: z.infer<typeof discoverRequestSchema>, store: ConnectionStore) {
  const source = input.sourceConnectionId ? store.connections.find(connection => connection.id === input.sourceConnectionId) : undefined;
  const account = input.accountId ? store.accounts.find(candidate => candidate.id === input.accountId) : undefined;
  const provider = account?.provider ?? source?.provider ?? input.provider;
  const baseUrl = account?.baseUrl ?? source?.baseUrl ?? normalizeBaseUrl(input.baseUrl);
  const requiresApiKey = account?.requiresApiKey ?? source?.requiresApiKey ?? input.requiresApiKey;
  const storedKey = account ? (await resolveAccountSecret(account)).value : source ? (await resolveSecret(source)).value : '';
  const apiKey = input.apiKey || storedKey;
  if (requiresApiKey && !apiKey) throw new Error('请输入 API Key 后再获取模型');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (apiKey) {
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'gemini' && !baseUrl.includes('/v1beta/openai')) {
      headers['x-goog-api-key'] = apiKey;
    } else {
      headers.authorization = `Bearer ${apiKey}`;
    }
  }
  const result = await fetch(modelsEndpoint(provider, baseUrl), { headers, signal: AbortSignal.timeout(12_000) });
  const raw = await result.text();
  let payload: unknown = {};
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    payload = {};
  }
  if (!result.ok) throw new Error(upstreamError(payload, result.status));
  const seen = new Set<string>();
  const models = modelCatalog(provider, payload)
    .filter(model => model.id && !seen.has(model.id) && seen.add(model.id))
    .slice(0, 1000);
  if (!models.length) throw new Error('API 已连接，但没有返回可选择的模型；可以使用手动添加');
  return { provider, baseUrl, requiresApiKey, models };
}

async function validateVolcengineCredentials(input: z.infer<typeof discoverRequestSchema>, store: ConnectionStore) {
  const source = input.sourceConnectionId ? store.connections.find(connection => connection.id === input.sourceConnectionId) : undefined;
  const account = input.accountId ? store.accounts.find(candidate => candidate.id === input.accountId) : undefined;
  const baseUrl = account?.baseUrl ?? source?.baseUrl ?? normalizeBaseUrl(input.baseUrl);
  const requiresApiKey = account?.requiresApiKey ?? source?.requiresApiKey ?? input.requiresApiKey;
  const storedKey = account ? (await resolveAccountSecret(account)).value : source ? (await resolveSecret(source)).value : '';
  const apiKey = input.apiKey || storedKey;
  if (requiresApiKey && !apiKey) throw new Error('请输入火山方舟 API Key');
  const origin = new URL(baseUrl).origin;
  const result = await fetch(`${origin}/ping`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(12_000)
  });
  if (!result.ok) throw new Error(connectionErrorMessage(result.status));
  return { provider: 'volcengine' as const, baseUrl, requiresApiKey, models: [] as Array<{ id: string; name: string }> };
}

async function inspectProvider(input: z.infer<typeof discoverRequestSchema>, store: ConnectionStore) {
  const account = input.accountId ? store.accounts.find(candidate => candidate.id === input.accountId) : undefined;
  const source = input.sourceConnectionId ? store.connections.find(connection => connection.id === input.sourceConnectionId) : undefined;
  const provider = account?.provider ?? source?.provider ?? input.provider;
  return provider === 'volcengine'
    ? validateVolcengineCredentials(input, store)
    : discoverModels(input, store);
}

async function publicConnection(connection: StoredConnection) {
  const key = await resolveSecret(connection);
  return {
    ...connection,
    accountId: credentialId(connection),
    gatewayModelId: gatewayModelName(connection),
    key: {
      configured: Boolean(key.value),
      masked: key.value ? maskedKey(key.value) : null,
      source: key.source
    }
  };
}

async function publicAccount(account: StoredAccount, store: ConnectionStore) {
  const key = await resolveAccountSecret(account);
  const enabledModels = new Set(store.connections
    .filter(connection => credentialId(connection) === account.id && connection.enabled)
    .map(connection => connection.modelId));
  return {
    ...account,
    catalog: account.catalog.map(model => ({ ...model, enabled: enabledModels.has(model.id) })),
    key: {
      configured: Boolean(key.value),
      masked: key.value ? maskedKey(key.value) : null,
      source: key.source
    }
  };
}

async function publicStore(store: ConnectionStore) {
  return {
    defaultConnectionId: store.defaultConnectionId,
    fallbackConnectionIds: store.fallbackConnectionIds,
    accounts: await Promise.all(store.accounts.map(account => publicAccount(account, store))),
    connections: await Promise.all(store.connections.map(publicConnection))
  };
}

function connectionErrorMessage(status: number) {
  if (status === 401) return 'API Key 无效或已失效';
  if (status === 403) return '当前 API Key 没有访问权限';
  if (status === 404) return '接口地址不支持 /models，请检查 Base URL';
  if (status === 429) return '触发调用频率或账户额度限制';
  return `服务返回 HTTP ${status}`;
}

function completionText(payload: unknown) {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => typeof part === 'object' && part && 'text' in part ? String((part as { text: unknown }).text) : '')
      .join('')
      .trim();
  }
  return '';
}

export async function getDeveloperApiRuntimeConfig() {
  const store = normalizeRouting(await readStore());
  const connection = store.connections.find(item => item.id === store.defaultConnectionId && item.enabled);
  if (!connection) return { connectionId: null, apiKey: '', baseURL: '', model: '', timeoutMs: 30_000, requiresApiKey: true };
  const key = await resolveSecret(connection);
  return {
    connectionId: connection.id,
    apiKey: key.value,
    baseURL: normalizeBaseUrl(connection.baseUrl),
    model: connection.modelId,
    timeoutMs: connection.timeoutMs,
    requiresApiKey: connection.requiresApiKey
  };
}

export async function handleDeveloperApi(request: IncomingMessage, response: ServerResponse) {
  try {
    const path = decodeURIComponent((request.url ?? '/').replace(/^\//, '').split('?')[0]);
    const parts = path ? path.split('/') : [];
    const store = normalizeRouting(await readStore());

    if (request.method === 'GET' && path === 'gateway') {
      await syncGatewayConfig(store);
      json(response, 200, await getGatewayStatus());
      return;
    }

    if (request.method === 'GET' && !path) {
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && path === 'discover') {
      const parsed = discoverRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: parsed.error.issues[0]?.message ?? '服务商配置不完整' });
        return;
      }
      try {
        const result = await inspectProvider(parsed.data, store);
        json(response, 200, {
          ...result,
          message: result.provider === 'volcengine' ? '火山方舟凭据核验成功，请添加模型或 Endpoint ID' : `已获取 ${result.models.length} 个可用模型`
        });
      } catch (error) {
        json(response, 422, { error: error instanceof Error ? error.message : '无法获取模型列表', allowManual: true });
      }
      return;
    }

    if (parts[0] === 'providers') {
      const accountId = parts[1] ?? '';
      const providerAction = parts[2] ?? '';
      const accountIndex = store.accounts.findIndex(account => account.id === accountId);

      if (request.method === 'POST' && !accountId) {
        const parsed = providerRequestSchema.safeParse(await readBody(request));
        if (!parsed.success) {
          json(response, 400, { error: parsed.error.issues[0]?.message ?? '服务商配置不完整' });
          return;
        }
        try {
          const discovery = await inspectProvider(parsed.data, store);
          const now = new Date().toISOString();
          const account: StoredAccount = {
            id: randomUUID(),
            name: parsed.data.name,
            provider: parsed.data.provider,
            baseUrl: normalizeBaseUrl(parsed.data.baseUrl),
            requiresApiKey: parsed.data.requiresApiKey,
            catalog: discovery.models,
            createdAt: now,
            updatedAt: now,
            lastDiscoveryAt: now
          };
          store.accounts.unshift(account);
          await writeStore(store);
          if (parsed.data.apiKey) await updateEnvValue(secretName(account.id), parsed.data.apiKey);
          json(response, 201, await publicStore(store));
        } catch (error) {
          json(response, 422, { error: error instanceof Error ? error.message : '服务商验证失败' });
        }
        return;
      }

      if (accountIndex < 0) {
        json(response, 404, { error: '没有找到这个模型提供商' });
        return;
      }
      const account = store.accounts[accountIndex];

      if (request.method === 'POST' && providerAction === 'refresh') {
        try {
          const discovery = await inspectProvider({
            provider: account.provider,
            baseUrl: account.baseUrl,
            requiresApiKey: account.requiresApiKey,
            accountId: account.id
          }, store);
          const active = store.connections
            .filter(connection => credentialId(connection) === account.id)
            .map(connection => ({ id: connection.modelId, name: '' }));
          const models = [...discovery.models, ...active];
          account.catalog = [...new Map(models.map(model => [model.id, model])).values()];
          account.lastDiscoveryAt = new Date().toISOString();
          account.updatedAt = account.lastDiscoveryAt;
          await writeStore(store);
          json(response, 200, await publicStore(store));
        } catch (error) {
          json(response, 422, { error: error instanceof Error ? error.message : '模型列表刷新失败' });
        }
        return;
      }

      if (request.method === 'POST' && providerAction === 'models') {
        const parsed = modelToggleSchema.safeParse(await readBody(request));
        if (!parsed.success) {
          json(response, 400, { error: parsed.error.issues[0]?.message ?? '模型状态不正确' });
          return;
        }
        const existingIndex = store.connections.findIndex(connection =>
          credentialId(connection) === account.id && connection.modelId === parsed.data.modelId);
        if (parsed.data.enabled && existingIndex < 0) {
          const now = new Date().toISOString();
          store.connections.unshift({
            id: randomUUID(),
            accountId: account.id,
            name: account.name,
            protocol: 'openai-compatible',
            provider: account.provider,
            baseUrl: account.baseUrl,
            modelId: parsed.data.modelId,
            reasoningEffort: 'none',
            timeoutMs: 30_000,
            enabled: true,
            requiresApiKey: account.requiresApiKey,
            createdAt: now,
            updatedAt: now,
            lastTest: null
          });
          if (!account.catalog.some(model => model.id === parsed.data.modelId)) {
            account.catalog.push({ id: parsed.data.modelId, name: '' });
          }
        }
        if (!parsed.data.enabled && existingIndex >= 0) store.connections.splice(existingIndex, 1);
        normalizeRouting(store);
        await writeStore(store);
        await syncGatewayConfig(store);
        json(response, 200, await publicStore(store));
        return;
      }

      if (request.method === 'PUT' && !providerAction) {
        const parsed = providerRequestSchema.safeParse(await readBody(request));
        if (!parsed.success) {
          json(response, 400, { error: parsed.error.issues[0]?.message ?? '服务商配置不完整' });
          return;
        }
        const storedKey = (await resolveAccountSecret(account)).value;
        const apiKey = parsed.data.apiKey || storedKey;
        try {
          const discovery = await inspectProvider({ ...parsed.data, apiKey }, store);
          const now = new Date().toISOString();
          const active = store.connections
            .filter(connection => credentialId(connection) === account.id)
            .map(connection => ({ id: connection.modelId, name: '' }));
          Object.assign(account, {
            name: parsed.data.name,
            provider: parsed.data.provider,
            baseUrl: normalizeBaseUrl(parsed.data.baseUrl),
            requiresApiKey: parsed.data.requiresApiKey,
            catalog: [...new Map([...discovery.models, ...active].map(model => [model.id, model])).values()],
            updatedAt: now,
            lastDiscoveryAt: now
          });
          for (const connection of store.connections.filter(item => credentialId(item) === account.id)) {
            Object.assign(connection, {
              name: account.name,
              provider: account.provider,
              baseUrl: account.baseUrl,
              requiresApiKey: account.requiresApiKey,
              updatedAt: now
            });
          }
          await writeStore(store);
          if (parsed.data.apiKey) await updateEnvValue(secretName(account.id), parsed.data.apiKey);
          await syncGatewayConfig(store);
          json(response, 200, await publicStore(store));
        } catch (error) {
          json(response, 422, { error: error instanceof Error ? error.message : '服务商验证失败' });
        }
        return;
      }

      if (request.method === 'DELETE' && !providerAction) {
        const removedConnectionIds = new Set(store.connections
          .filter(connection => credentialId(connection) === account.id)
          .map(connection => connection.id));
        store.accounts.splice(accountIndex, 1);
        store.connections = store.connections.filter(connection => !removedConnectionIds.has(connection.id));
        await updateEnvValue(secretName(account.id), null);
        normalizeRouting(store);
        await writeStore(store);
        await syncGatewayConfig(store);
        json(response, 200, await publicStore(store));
        return;
      }

      json(response, 405, { error: '不支持这个提供商操作' });
      return;
    }

    if (request.method === 'POST' && path === 'accounts') {
      const parsed = accountRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: parsed.error.issues[0]?.message ?? '模型选择不完整' });
        return;
      }
      const source = parsed.data.sourceConnectionId
        ? store.connections.find(connection => connection.id === parsed.data.sourceConnectionId)
        : undefined;
      if (parsed.data.sourceConnectionId && !source) {
        json(response, 404, { error: '没有找到原来的服务商连接' });
        return;
      }
      const provider = source?.provider ?? parsed.data.provider;
      const baseUrl = source?.baseUrl ?? normalizeBaseUrl(parsed.data.baseUrl);
      const requiresApiKey = source?.requiresApiKey ?? parsed.data.requiresApiKey;
      const accountId = source ? credentialId(source) : randomUUID();
      const availableKey = parsed.data.apiKey || (source ? (await resolveSecret(source)).value : '');
      if (requiresApiKey && !availableKey) {
        json(response, 400, { error: '这个服务商需要 API Key，请返回上一步填写' });
        return;
      }
      let account = store.accounts.find(candidate => candidate.id === accountId);
      if (!account) {
        const createdAt = new Date().toISOString();
        account = {
          id: accountId,
          name: source?.name ?? parsed.data.name,
          provider,
          baseUrl,
          requiresApiKey,
          catalog: [],
          createdAt,
          updatedAt: createdAt,
          lastDiscoveryAt: null
        };
        store.accounts.unshift(account);
      }
      const existingModels = new Set(store.connections
        .filter(connection => credentialId(connection) === accountId)
        .map(connection => connection.modelId));
      const modelIds = [...new Set(parsed.data.modelIds)].filter(modelId => !existingModels.has(modelId));
      if (!modelIds.length) {
        json(response, 409, { error: '选择的模型已经全部添加过了' });
        return;
      }
      const now = new Date().toISOString();
      for (const modelId of modelIds) {
        if (!account.catalog.some(model => model.id === modelId)) account.catalog.push({ id: modelId, name: '' });
      }
      account.updatedAt = now;
      const connections: StoredConnection[] = modelIds.map(modelId => ({
        id: randomUUID(),
        accountId,
        name: source?.name ?? parsed.data.name,
        protocol: 'openai-compatible',
        provider,
        baseUrl,
        modelId,
        reasoningEffort: 'none',
        timeoutMs: source?.timeoutMs ?? 30_000,
        enabled: true,
        requiresApiKey,
        createdAt: now,
        updatedAt: now,
        lastTest: null
      }));
      store.connections.unshift(...connections);
      if (!store.defaultConnectionId) store.defaultConnectionId = connections[0].id;
      normalizeRouting(store);
      await writeStore(store);
      if (parsed.data.apiKey) await updateEnvValue(secretName(accountId), parsed.data.apiKey);
      await syncGatewayConfig(store);
      json(response, 201, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && !path) {
      const parsed = saveRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: parsed.error.issues[0]?.message ?? 'API 连接不符合要求' });
        return;
      }
      const { apiKey, ...input } = parsed.data;
      const now = new Date().toISOString();
      const id = randomUUID();
      const connection: StoredConnection = {
        ...input,
        baseUrl: normalizeBaseUrl(input.baseUrl),
        id,
        accountId: id,
        createdAt: now,
        updatedAt: now,
        lastTest: null
      };
      store.accounts.unshift({
        id,
        name: connection.name,
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        requiresApiKey: connection.requiresApiKey,
        catalog: [{ id: connection.modelId, name: '' }],
        createdAt: now,
        updatedAt: now,
        lastDiscoveryAt: null
      });
      store.connections.unshift(connection);
      if (!store.defaultConnectionId) store.defaultConnectionId = connection.id;
      normalizeRouting(store);
      await writeStore(store);
      if (apiKey) await updateEnvValue(secretName(credentialId(connection)), apiKey);
      await syncGatewayConfig(store);
      json(response, 201, await publicStore(store));
      return;
    }

    const id = parts[0] ?? '';
    const action = parts[1] ?? '';
    const index = store.connections.findIndex(connection => connection.id === id);
    if (index < 0) {
      json(response, 404, { error: '没有找到这个 API 连接' });
      return;
    }

    if (request.method === 'PUT' && !action) {
      const parsed = saveRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: parsed.error.issues[0]?.message ?? 'API 连接不符合要求' });
        return;
      }
      const { apiKey, ...input } = parsed.data;
      const previous = store.connections[index];
      const changedEndpoint = previous.baseUrl !== normalizeBaseUrl(input.baseUrl) || previous.modelId !== input.modelId;
      store.connections[index] = {
        ...previous,
        ...input,
        baseUrl: normalizeBaseUrl(input.baseUrl),
        updatedAt: new Date().toISOString(),
        lastTest: changedEndpoint ? null : previous.lastTest
      };
      normalizeRouting(store);
      await writeStore(store);
      if (apiKey) await updateEnvValue(secretName(credentialId(store.connections[index])), apiKey);
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && action === 'default') {
      if (!store.connections[index].enabled) {
        json(response, 409, { error: '请先启用这个连接，再将它设为默认连接' });
        return;
      }
      store.defaultConnectionId = id;
      normalizeRouting(store);
      await writeStore(store);
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && action === 'fallback') {
      const connection = store.connections[index];
      if (!connection.enabled) {
        json(response, 409, { error: '请先启用这个连接，再将它加入备用链' });
        return;
      }
      if (store.defaultConnectionId === id) {
        json(response, 409, { error: '主模型不能同时加入备用链' });
        return;
      }
      const fallbackIndex = store.fallbackConnectionIds.indexOf(id);
      if (fallbackIndex >= 0) store.fallbackConnectionIds.splice(fallbackIndex, 1);
      else store.fallbackConnectionIds.push(id);
      normalizeRouting(store);
      await writeStore(store);
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && (action === 'fallback-up' || action === 'fallback-down')) {
      const fallbackIndex = store.fallbackConnectionIds.indexOf(id);
      if (fallbackIndex < 0) {
        json(response, 409, { error: '这个连接还没有加入备用链' });
        return;
      }
      const nextIndex = action === 'fallback-up' ? fallbackIndex - 1 : fallbackIndex + 1;
      if (nextIndex >= 0 && nextIndex < store.fallbackConnectionIds.length) {
        [store.fallbackConnectionIds[fallbackIndex], store.fallbackConnectionIds[nextIndex]] =
          [store.fallbackConnectionIds[nextIndex], store.fallbackConnectionIds[fallbackIndex]];
      }
      normalizeRouting(store);
      await writeStore(store);
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    if (request.method === 'POST' && action === 'test') {
      const connection = store.connections[index];
      const key = await resolveSecret(connection);
      if (connection.requiresApiKey && !key.value) {
        json(response, 400, { error: '这个连接要求 API Key，请先编辑并保存密钥' });
        return;
      }
      const startedAt = Date.now();
      try {
        await syncGatewayConfig(store);
        let gateway = await getGatewayStatus();
        for (let attempt = 0; attempt < 8 && !gateway.models.some(model => model.id === gatewayModelName(connection)); attempt += 1) {
          await new Promise(resolveDelay => setTimeout(resolveDelay, 350));
          gateway = await getGatewayStatus();
        }
        if (gateway.status !== 'online') throw new Error(gateway.message);
        if (!gateway.models.some(model => model.id === gatewayModelName(connection))) {
          throw new Error('LiteLLM 尚未载入这个模型，请确认网关正在以热重载模式运行');
        }
        const { masterKey, baseUrl } = await gatewayConnection();
        const completion = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${masterKey}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: gatewayModelName(connection),
            messages: [{ role: 'user', content: '这是一次 API 连通性测试。请只回复：连接成功' }],
            max_tokens: 32
          }),
          signal: AbortSignal.timeout(connection.timeoutMs)
        });
        const raw = await completion.text();
        let payload: unknown = {};
        try {
          payload = JSON.parse(raw) as unknown;
        } catch {
          payload = {};
        }
        if (!completion.ok) {
          const detail = (payload as { error?: { message?: unknown } }).error?.message;
          throw new Error(typeof detail === 'string' ? detail : `模型调用失败（HTTP ${completion.status}）`);
        }
        const output = completionText(payload);
        if (!output) throw new Error('模型接口已响应，但没有返回可显示的文字');
        connection.lastTest = {
          status: 'success',
          checkedAt: new Date().toISOString(),
          message: `模型实际返回：${output.slice(0, 240)}`,
          latencyMs: Date.now() - startedAt
        };
        connection.updatedAt = new Date().toISOString();
        await writeStore(store);
        json(response, 200, await publicStore(store));
      } catch (error) {
        const message = error instanceof Error ? error.message : '网关检查失败';
        connection.lastTest = {
          status: 'failed',
          checkedAt: new Date().toISOString(),
          message,
          latencyMs: Date.now() - startedAt
        };
        connection.updatedAt = new Date().toISOString();
        await writeStore(store);
        json(response, 422, { ...(await publicStore(store)), error: message });
      }
      return;
    }

    if (request.method === 'DELETE' && !action) {
      const [removed] = store.connections.splice(index, 1);
      const removedCredentialId = credentialId(removed);
      if (!store.connections.some(connection => credentialId(connection) === removedCredentialId)
        && !store.accounts.some(account => account.id === removedCredentialId)) {
        await updateEnvValue(secretName(removedCredentialId), null);
      }
      normalizeRouting(store);
      await writeStore(store);
      await syncGatewayConfig(store);
      json(response, 200, await publicStore(store));
      return;
    }

    json(response, 405, { error: '不支持这个请求方式' });
  } catch (error) {
    console.error('[developer-api]', error);
    if (error instanceof SyntaxError) {
      json(response, 400, { error: '请求内容不是有效的 JSON' });
      return;
    }
    json(response, 500, { error: 'API 连接操作失败，请检查本地文件权限' });
  }
}
