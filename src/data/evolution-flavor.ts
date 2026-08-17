import type { EvolutionFlavor, EvolutionGeneration, EvolutionId } from '../types';

export const EVOLUTION_ROUTE_IDS: EvolutionId[] = [
  'stormwing_archer',
  'burrow_hunter',
  'tidal_shaman'
];

const FALLBACK_THEMES = [
  { noun: '星陨', mood: '星辉 / 勇毅', hook: '一颗坠落的星辰回应了精灵的誓言。' },
  { noun: '烬火', mood: '炽烈 / 不羁', hook: '沉睡已久的古老余烬在它体内苏醒。' },
  { noun: '月隐', mood: '神秘 / 沉静', hook: '月光照亮了一条凡眼无法看见的道路。' },
  { noun: '荆棘', mood: '野性 / 坚毅', hook: '森林将这位幸存者认作了自己的孩子。' }
];

const ROUTE_COPY: Record<EvolutionId, { suffix: string; visual: string }> = {
  stormwing_archer: {
    suffix: '天穹猎手',
    visual: '宽阔发光的双翼、流线形身姿，以及在远处跃动的雷霆能量'
  },
  burrow_hunter: {
    suffix: '地脉利爪',
    visual: '厚重的掘地利爪、层叠岩甲，以及贴近地面的伏击轮廓'
  },
  tidal_shaman: {
    suffix: '潮汐唤者',
    visual: '流动的鳍、半透明水冠，以及环绕身体旋转的水滴'
  }
};

function promptHash(prompt: string) {
  let hash = 2166136261;
  for (const char of prompt) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function fallbackEvolutionGeneration(prompt: string, note = '正在使用符合规则的本地创意。'): EvolutionGeneration {
  const theme = FALLBACK_THEMES[promptHash(prompt || 'random') % FALLBACK_THEMES.length];
  return {
    source: 'fallback',
    note,
    variants: EVOLUTION_ROUTE_IDS.map(routeId => ({
      routeId,
      name: `${theme.noun}·${ROUTE_COPY[routeId].suffix}`,
      tagline: theme.mood,
      storyHook: theme.hook,
      visualDescription: ROUTE_COPY[routeId].visual
    }))
  };
}

function isShortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function validEvolutionFlavors(value: unknown): value is EvolutionFlavor[] {
  if (!Array.isArray(value) || value.length !== EVOLUTION_ROUTE_IDS.length) return false;
  const routes = new Set<EvolutionId>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return false;
    const flavor = item as Partial<EvolutionFlavor>;
    if (!EVOLUTION_ROUTE_IDS.includes(flavor.routeId as EvolutionId)) return false;
    if (!isShortText(flavor.name, 36) || !isShortText(flavor.tagline, 48)) return false;
    if (!isShortText(flavor.storyHook, 120) || !isShortText(flavor.visualDescription, 180)) return false;
    routes.add(flavor.routeId as EvolutionId);
  }
  return routes.size === EVOLUTION_ROUTE_IDS.length;
}
