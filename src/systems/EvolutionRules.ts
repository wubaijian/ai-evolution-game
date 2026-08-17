import rawRules from '../data/evolution-rules.json';
import type {
  EvolutionAbilityId,
  EvolutionDef,
  EvolutionRulesConfig,
  EvolutionValidation
} from '../types';

export const EVOLUTION_RULES = rawRules as EvolutionRulesConfig;

export function validateEvolution(evolution: EvolutionDef): EvolutionValidation {
  const errors: string[] = [];
  const statValues = Object.values(evolution.stats);
  const statTotal = statValues.reduce((sum, value) => sum + value, 0);

  if (statValues.some(value => !Number.isInteger(value) || value < 0 || value > EVOLUTION_RULES.statMax)) {
    errors.push(`每项属性都必须是 0 到 ${EVOLUTION_RULES.statMax} 的整数。`);
  }
  if (statTotal !== EVOLUTION_RULES.statBudget) {
    errors.push(`属性点总和必须为 ${EVOLUTION_RULES.statBudget}，当前为 ${statTotal}。`);
  }
  if (Math.max(...statValues) < EVOLUTION_RULES.statStrengthMin) {
    errors.push(`至少一项属性必须达到 ${EVOLUTION_RULES.statStrengthMin}。`);
  }
  if (Math.min(...statValues) > EVOLUTION_RULES.statWeaknessMax) {
    errors.push(`至少一项属性必须不高于 ${EVOLUTION_RULES.statWeaknessMax}。`);
  }
  if (evolution.stats.attack === EVOLUTION_RULES.statMax && evolution.stats.speed === EVOLUTION_RULES.statMax) {
    errors.push('攻击和速度不能同时达到最高值。');
  }

  const uniqueAbilities = new Set(evolution.abilities);
  if (uniqueAbilities.size !== evolution.abilities.length) errors.push('能力不能重复。');

  let abilityTotal = 0;
  for (const ability of uniqueAbilities) {
    const cost = EVOLUTION_RULES.abilityCosts[ability];
    if (cost === undefined) errors.push(`未知能力：${ability}。`);
    else abilityTotal += cost;
  }
  if (abilityTotal > EVOLUTION_RULES.abilityBudget) {
    errors.push(`能力成本不能超过 ${EVOLUTION_RULES.abilityBudget}，当前为 ${abilityTotal}。`);
  }
  if (EVOLUTION_RULES.requireFullAbilityBudget && abilityTotal !== EVOLUTION_RULES.abilityBudget) {
    errors.push(`当前原型必须恰好使用 ${EVOLUTION_RULES.abilityBudget} 点能力成本，当前为 ${abilityTotal}。`);
  }

  const movementCount = EVOLUTION_RULES.specialMovementAbilities
    .filter(ability => uniqueAbilities.has(ability)).length;
  if (movementCount !== 1) errors.push('必须且只能选择一种特殊移动形态。');

  const expectedMovement = EVOLUTION_RULES.movementAbilityByForm[evolution.movementForm];
  if (!uniqueAbilities.has(expectedMovement)) {
    errors.push(`移动形态 ${evolution.movementForm} 需要能力 ${expectedMovement}。`);
  }

  const coreCount = EVOLUTION_RULES.highValueCoreAbilities
    .filter(ability => uniqueAbilities.has(ability)).length;
  if (coreCount > 1) errors.push('高价值核心能力最多只能选择一个。');

  for (const conflict of EVOLUTION_RULES.incompatibleAbilities) {
    if (conflict.abilities.every(ability => uniqueAbilities.has(ability))) errors.push(conflict.reason);
  }

  if (evolution.strengths.length === 0) errors.push('至少需要一项优势。');
  if (evolution.tradeoffs.length === 0) errors.push('至少需要一项代价。');

  return {
    legal: errors.length === 0,
    statTotal,
    statBudget: EVOLUTION_RULES.statBudget,
    abilityTotal,
    abilityBudget: EVOLUTION_RULES.abilityBudget,
    errors
  };
}

export function abilityCost(ability: EvolutionAbilityId): number | undefined {
  return EVOLUTION_RULES.abilityCosts[ability];
}
