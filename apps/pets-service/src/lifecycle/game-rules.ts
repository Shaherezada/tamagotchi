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
