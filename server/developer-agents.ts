import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const agentInputSchema = z.object({
  name: z.string().trim().min(2, '名称至少需要 2 个字').max(30, '名称不能超过 30 个字'),
  role: z.string().trim().min(2, '角色定位至少需要 2 个字').max(50, '角色定位不能超过 50 个字'),
  description: z.string().trim().max(160, '简介不能超过 160 个字'),
  objective: z.string().trim().min(5, '核心目标至少需要 5 个字').max(500, '核心目标不能超过 500 个字'),
  systemPrompt: z.string().trim().min(10, '系统提示词至少需要 10 个字').max(4000, '系统提示词不能超过 4000 个字'),
  modelConnectionId: z.string().uuid('请选择一个模型').nullable(),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']),
  status: z.enum(['draft', 'active', 'disabled']),
  permissions: z.object({
    generateFlavor: z.boolean(),
    generateStory: z.boolean(),
    generateVisuals: z.boolean()
  })
});

const storedAgentSchema = agentInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  skillIds: z.array(z.string()).default([])
});

const storedAgentsSchema = z.array(storedAgentSchema);
export type StoredAgent = z.infer<typeof storedAgentSchema>;

const DATA_FILE = resolve(process.cwd(), 'developer-data/agents.json');

async function readAgents(): Promise<StoredAgent[]> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as unknown;
    const parsed = Array.isArray(raw) ? raw.map(item => {
      if (!item || typeof item !== 'object' || 'modelConnectionId' in item) return item;
      const { model: _legacyModel, ...rest } = item as Record<string, unknown>;
      return { ...rest, modelConnectionId: null };
    }) : raw;
    return storedAgentsSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAgents(agents: StoredAgent[]) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(agents, null, 2)}\n`, 'utf8');
  await rename(tempFile, DATA_FILE);
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
  response.end(JSON.stringify(payload));
}

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Agent 配置不符合要求';
}

export async function handleDeveloperAgents(request: IncomingMessage, response: ServerResponse) {
  try {
    const id = decodeURIComponent((request.url ?? '/').replace(/^\//, '').split('?')[0]);
    const agents = await readAgents();

    if (request.method === 'GET' && !id) {
      json(response, 200, { agents });
      return;
    }

    if (request.method === 'POST' && !id) {
      const parsed = agentInputSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: validationMessage(parsed.error) });
        return;
      }
      const now = new Date().toISOString();
      const agent: StoredAgent = {
        ...parsed.data,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        skillIds: []
      };
      agents.unshift(agent);
      await writeAgents(agents);
      json(response, 201, { agent });
      return;
    }

    const index = agents.findIndex(agent => agent.id === id);
    if (index < 0) {
      json(response, 404, { error: '没有找到这个 Agent' });
      return;
    }

    if (request.method === 'PUT') {
      const parsed = agentInputSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: validationMessage(parsed.error) });
        return;
      }
      agents[index] = {
        ...agents[index],
        ...parsed.data,
        updatedAt: new Date().toISOString()
      };
      await writeAgents(agents);
      json(response, 200, { agent: agents[index] });
      return;
    }

    if (request.method === 'DELETE') {
      const [removed] = agents.splice(index, 1);
      await writeAgents(agents);
      json(response, 200, { agent: removed });
      return;
    }

    json(response, 405, { error: '不支持这个请求方式' });
  } catch (error) {
    console.error('[developer-agents]', error);
    json(response, 500, { error: 'Agent 配置保存失败，请检查本地数据文件' });
  }
}
