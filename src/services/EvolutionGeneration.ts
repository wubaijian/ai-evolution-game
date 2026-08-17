import { fallbackEvolutionGeneration, validEvolutionFlavors } from '../data/evolution-flavor';
import type { EvolutionGeneration } from '../types';

export async function generateEvolutionIdeas(prompt: string): Promise<EvolutionGeneration> {
  const cleanPrompt = prompt.trim().slice(0, 400);
  if (!cleanPrompt) return fallbackEvolutionGeneration('随机精灵');

  try {
    const response = await fetch('/api/evolutions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: cleanPrompt })
    });
    if (!response.ok) throw new Error(`generation endpoint returned ${response.status}`);
    const data = await response.json() as Partial<EvolutionGeneration>;
    if (!validEvolutionFlavors(data.variants)) throw new Error('generation endpoint returned invalid routes');
    return {
      source: data.source === 'openai' ? 'openai' : 'fallback',
      variants: data.variants,
      note: typeof data.note === 'string' ? data.note : undefined
    };
  } catch {
    return fallbackEvolutionGeneration(cleanPrompt, 'AI 暂不可用，已改用符合规则的本地创意。');
  }
}
