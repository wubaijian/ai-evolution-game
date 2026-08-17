import rawEvolutions from './evolutions.json';
import { validateEvolution } from '../systems/EvolutionRules';
import type { CreatureFormId, EvolutionDef, EvolutionId } from '../types';

export const BASE_EVOLUTION_ID: CreatureFormId = 'base_creature';
export const BASE_EVOLUTION: EvolutionDef = {
  id: BASE_EVOLUTION_ID,
  name: '基础精灵',
  nameZh: '基础精灵',
  tagline: '尚未完成第一次进化',
  color: '#d8d3c0',
  tint: 0xd8d3c0,
  movementForm: 'flight',
  attackForm: 'ranged',
  stats: { attack: 2, speed: 2, defense: 2, energy: 2 },
  abilities: [],
  strengths: ['能力均衡'],
  tradeoffs: ['核心技能尚未觉醒'],
  modifiers: {
    maxHpMult: 1,
    moveSpeedMult: 1,
    primaryDamageMult: 1,
    primaryCooldownMult: 1,
    projectileSpeedMult: 1,
    coreDamageMult: 1,
    coreRadiusMult: 1,
    coreCooldownMult: 1,
    dodgeCooldownMult: 1,
    dodgeSpeedMult: 1
  }
};

export const EVOLUTIONS = rawEvolutions as (EvolutionDef & { id: EvolutionId })[];
export const EVOLUTION_VALIDATIONS = new Map(
  EVOLUTIONS.map(evolution => [evolution.id, validateEvolution(evolution)])
);

export const DEFAULT_EVOLUTION_ID: EvolutionId = 'stormwing_archer';

export function evolutionFor(id: CreatureFormId): EvolutionDef {
  if (id === BASE_EVOLUTION_ID) return BASE_EVOLUTION;
  const requested = EVOLUTIONS.find(evolution => evolution.id === id);
  if (requested && EVOLUTION_VALIDATIONS.get(requested.id)?.legal) return requested;
  const fallback = EVOLUTIONS.find(evolution => EVOLUTION_VALIDATIONS.get(evolution.id)?.legal);
  if (!fallback) throw new Error('No legal evolution definitions are available.');
  return fallback;
}

export function isEvolutionId(value: unknown): value is EvolutionId {
  return EVOLUTIONS.some(evolution => evolution.id === value);
}

export function isCreatureFormId(value: unknown): value is CreatureFormId {
  return value === BASE_EVOLUTION_ID || isEvolutionId(value);
}

export function evolutionValidationFor(id: EvolutionId) {
  return EVOLUTION_VALIDATIONS.get(id) ?? validateEvolution(evolutionFor(id));
}
