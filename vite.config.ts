import { defineConfig, loadEnv, type Plugin } from 'vite';
import { resolve } from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import { fallbackEvolutionGeneration, validEvolutionFlavors } from './src/data/evolution-flavor';
import { handleDeveloperAgents } from './server/developer-agents';
import { handleDeveloperSkills } from './server/developer-skills';
import { getDeveloperApiRuntimeConfig, handleDeveloperApi, setStartupApiKey } from './server/developer-api';

const evolutionFlavorSchema = z.object({
  variants: z.array(z.object({
    routeId: z.enum(['stormwing_archer', 'burrow_hunter', 'tidal_shaman']),
    name: z.string().min(1).max(36),
    tagline: z.string().min(1).max(48),
    storyHook: z.string().min(1).max(120),
    visualDescription: z.string().min(1).max(180)
  })).length(3)
});

function parseEvolutionJson(value: string | null | undefined) {
  if (!value) throw new Error('Model returned empty content.');
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return evolutionFlavorSchema.parse(JSON.parse(cleaned));
}

function evolutionApi(): Plugin {
  return {
    name: 'evolution-api',
    configureServer(server) {
      server.middlewares.use('/api/developer/agents', (request, response) => {
        void handleDeveloperAgents(request, response);
      });
      server.middlewares.use('/api/developer/skills', (request, response) => {
        void handleDeveloperSkills(request, response);
      });
      server.middlewares.use('/api/developer/api', (request, response) => {
        void handleDeveloperApi(request, response);
      });
      server.middlewares.use('/api/evolutions', async (request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8');
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: '仅支持 POST 请求' }));
          return;
        }

        let rawBody = '';
        for await (const chunk of request) rawBody += chunk;
        let prompt = '';
        try {
          const parsed = JSON.parse(rawBody) as { prompt?: unknown };
          prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim().slice(0, 400) : '';
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: '请求内容不是有效的 JSON' }));
          return;
        }
        if (!prompt) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: '请先填写精灵描述' }));
          return;
        }

        const apiConfig = await getDeveloperApiRuntimeConfig();
        if (!apiConfig.connectionId || (apiConfig.requiresApiKey && !apiConfig.apiKey)) {
          response.end(JSON.stringify(fallbackEvolutionGeneration(
            prompt,
            '尚未配置可用的默认模型连接，已改用符合规则的本地创意。'
          )));
          return;
        }

        try {
          const client = new OpenAI({
            apiKey: apiConfig.apiKey || 'local-development',
            baseURL: apiConfig.baseURL,
            timeout: apiConfig.timeoutMs
          });
          const result = await client.chat.completions.create({
            model: apiConfig.model,
            messages: [
              {
                role: 'system',
                content: [
                  '为全年龄浏览器动作游戏创作精灵进化风味文案。',
                  '必须为每个给定的 route id 各返回一个不同的创意。',
                  '只能创作名称、短标签、故事引子和外观描述。',
                  '绝不能发明或修改属性、伤害、速度、成本、能力或 route id。',
                  '使用简洁自然的简体中文，文案需要适合像素游戏界面。',
                  '只返回 JSON，不要使用 Markdown。格式为 {"variants":[{"routeId":"...","name":"...","tagline":"...","storyHook":"...","visualDescription":"..."}]}。'
                ].join(' ')
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1200
          });
          const variants = parseEvolutionJson(result.choices[0]?.message.content).variants;
          if (!validEvolutionFlavors(variants)) throw new Error('Model returned duplicate or invalid route ids.');
          response.end(JSON.stringify({ source: 'api', variants }));
        } catch (error) {
          console.warn('[evolution-api] OpenAI generation failed; using fallback.', error);
          response.end(JSON.stringify(fallbackEvolutionGeneration(
            prompt,
            'AI 请求失败，已改用符合规则的本地创意。'
          )));
        }
      });
    }
  };
}

// base './' so the build works from any subpath (GitHub Pages project site)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OPENAI_');
  setStartupApiKey(env.OPENAI_API_KEY);
  return {
    base: './',
    plugins: [evolutionApi()],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          game: resolve(__dirname, 'index.html'),
          developer: resolve(__dirname, 'developer/index.html')
        }
      }
    },
    server: {
      port: 5173
    }
  };
});
