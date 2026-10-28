import { Stage } from '../pets/pet-enums';
import type { PetsEnv } from '../pets-env';

/** Числа правил жизни питомца (§8) в игровых минутах; gameSpeed переводит их в реальное время. */
export class GameRules {
  gameSpeed: number;
  stageMinutes: Record<Stage, number>;
  decayMinutes: number;
  callMinutes: number;
  neglectHours: number;
}

export function gameRulesFromEnv(env: PetsEnv): GameRules {
  return {
    gameSpeed: env.GAME_SPEED,
    stageMinutes: {
      [Stage.EGG]: 5,
      [Stage.BABY]: 60,
      [Stage.CHILD]: 8 * 60,
      [Stage.TEEN]: 24 * 60,
      [Stage.ADULT]: 72 * 60,
      [Stage.ELDER]: 48 * 60,
    },
    decayMinutes: 30,
    callMinutes: 15,
    neglectHours: 12,
  };
}

/** Постоянные правила §8, которые не настраиваются (в GameRules – только то, что есть на диаграмме классов). */
export const MAX_HEARTS = 4;
export const MAX_DISCIPLINE = 100;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 999;
export const START_WEIGHT = 10;
export const START_DISCIPLINE = 0;
export const DISCIPLINE_DECAY = 5;
export const DISCIPLINE_DECAY_MINUTES = 6 * 60;
export const SCOLD_DISCIPLINE = 25;
export const MAX_POOP = 4;
/** Столько какашек – зов DIRTY. */
export const DIRTY_POOP = 3;
export const POOP_MINUTES = 3 * 60;
export const POOP_JITTER_MINUTES = 15;
/** Вероятность каприза в каждую точку падения показателей (раз в decayMinutes), если питомец бодрствует и спокоен. */
export const MISBEHAVE_CHANCE = 0.1;
export const MAX_ALIVE_PETS = 3;

const MINUTE_MS = 60_000;

/** Игровые минуты → реальные миллисекунды (целые, чтобы точки сетки времени совпадали точно). */
export function gameMinutesToMs(rules: GameRules, minutes: number): number {
  return Math.max(1, Math.round((minutes * MINUTE_MS) / rules.gameSpeed));
}

/** Реальные миллисекунды → полные игровые сутки. */
export function gameDays(rules: GameRules, realMs: number): number {
  return Math.floor((realMs * rules.gameSpeed) / (24 * 60 * MINUTE_MS));
}
