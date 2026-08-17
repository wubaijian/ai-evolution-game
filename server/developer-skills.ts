import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const jsonObjectSchema = z.record(z.string(), z.unknown());

const skillInputSchema = z.object({
  name: z.string().trim().min(2, '名称至少需要 2 个字').max(40, '名称不能超过 40 个字'),
  key: z.string().trim().min(3, '唯一标识至少需要 3 个字符').max(60, '唯一标识不能超过 60 个字符')
    .regex(/^[a-z][a-z0-9_]*$/, '唯一标识只能使用小写字母、数字和下划线，并以字母开头'),
  category: z.enum(['evolution', 'story', 'combat', 'utility']),
  description: z.string().trim().min(5, '简介至少需要 5 个字').max(200, '简介不能超过 200 个字'),
  trigger: z.string().trim().min(5, '触发条件至少需要 5 个字').max(300, '触发条件不能超过 300 个字'),
  promptTemplate: z.string().trim().min(20, '提示词模板至少需要 20 个字').max(6000, '提示词模板不能超过 6000 个字'),
  inputSchema: jsonObjectSchema,
  outputSchema: jsonObjectSchema,
  status: z.enum(['draft', 'active', 'disabled']),
  permissions: z.object({
    readPlayerPrompt: z.boolean(),
    readGameRules: z.boolean(),
    writeFlavor: z.boolean(),
    writeStory: z.boolean(),
    writeVisuals: z.boolean()
  })
});

const storedSkillSchema = skillInputSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const storedSkillsSchema = z.array(storedSkillSchema);
export type StoredSkill = z.infer<typeof storedSkillSchema>;

const DATA_FILE = resolve(process.cwd(), 'developer-data/skills.json');

async function readSkills(): Promise<StoredSkill[]> {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8')) as unknown;
    return storedSkillsSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeSkills(skills: StoredSkill[]) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(skills, null, 2)}\n`, 'utf8');
  await rename(tempFile, DATA_FILE);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 128_000) throw new Error('请求内容过大');
  }
  return JSON.parse(raw || '{}') as unknown;
}

function json(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Skill 配置不符合要求';
}

export async function handleDeveloperSkills(request: IncomingMessage, response: ServerResponse) {
  try {
    const id = decodeURIComponent((request.url ?? '/').replace(/^\//, '').split('?')[0]);
    const skills = await readSkills();

    if (request.method === 'GET' && !id) {
      json(response, 200, { skills });
      return;
    }

    if (request.method === 'POST' && !id) {
      const parsed = skillInputSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: validationMessage(parsed.error) });
        return;
      }
      if (skills.some(skill => skill.key === parsed.data.key)) {
        json(response, 409, { error: '这个唯一标识已被其他 Skill 使用' });
        return;
      }
      const now = new Date().toISOString();
      const skill: StoredSkill = {
        ...parsed.data,
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now
      };
      skills.unshift(skill);
      await writeSkills(skills);
      json(response, 201, { skill });
      return;
    }

    const index = skills.findIndex(skill => skill.id === id);
    if (index < 0) {
      json(response, 404, { error: '没有找到这个 Skill' });
      return;
    }

    if (request.method === 'PUT') {
      const parsed = skillInputSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        json(response, 400, { error: validationMessage(parsed.error) });
        return;
      }
      if (skills.some((skill, skillIndex) => skillIndex !== index && skill.key === parsed.data.key)) {
        json(response, 409, { error: '这个唯一标识已被其他 Skill 使用' });
        return;
      }
      skills[index] = {
        ...skills[index],
        ...parsed.data,
        version: skills[index].version + 1,
        updatedAt: new Date().toISOString()
      };
      await writeSkills(skills);
      json(response, 200, { skill: skills[index] });
      return;
    }

    if (request.method === 'DELETE') {
      const [removed] = skills.splice(index, 1);
      await writeSkills(skills);
      json(response, 200, { skill: removed });
      return;
    }

    json(response, 405, { error: '不支持这个请求方式' });
  } catch (error) {
    console.error('[developer-skills]', error);
    if (error instanceof SyntaxError) {
      json(response, 400, { error: '请求内容不是有效的 JSON' });
      return;
    }
    json(response, 500, { error: 'Skill 配置保存失败，请检查本地数据文件' });
  }
}
