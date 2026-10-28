import type { ApplyCareActionRequest } from '@app/contracts';
import { gameRulesFromEnv, type GameRules } from '../src/lifecycle/game-rules';
import { PetForm } from '../src/pets/entities/pet-form.entity';
import { Pet } from '../src/pets/entities/pet.entity';
import { Stage } from '../src/pets/pet-enums';
import { chooseFormCode, petFormByCode } from '../src/pets/pet-forms.catalog';
import type { PetsEnv } from '../src/pets-env';

/** Начало отсчёта в тестах: поддельное «сейчас» – T0 + минуты. */
export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const PET_ID = '11111111-1111-4111-8111-111111111111';
export const OWNER_ID = '22222222-2222-4222-8222-222222222222';

export function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000);
}

export function rules(gameSpeed = 1): GameRules {
  return gameRulesFromEnv({ GAME_SPEED: gameSpeed } as PetsEnv);
}

/** Rng-заглушка: 0.99 – капризов нет, 0 – каприз в каждой точке. */
export const calm = (): number => 0.99;
export const naughty = (): number => 0;

/** Сытый, весёлый, здоровый питомец, только что вошедший в стадию stage (по умолчанию ADULT) в момент T0. */
export function makePet(overrides: Partial<Pet> = {}): Pet {
  const stage = overrides.stage ?? Stage.ADULT;
  return Object.assign(new Pet(), {
    id: PET_ID,
    ownerId: OWNER_ID,
    name: 'Пушок',
    stage,
    form: Object.assign(new PetForm(), petFormByCode(chooseFormCode(stage, 0, 0))),
    hunger: 4,
    happiness: 4,
    discipline: 0,
    weight: 10,
    poopCount: 0,
    isSick: false,
    isSleeping: false,
    attention: null,
    attentionSince: null,
    mistakeCounted: false,
    careMistakes: 0,
    starvingSince: null,
    bornAt: T0,
    stageSince: T0,
    simulatedAt: T0,
    nextTickAt: T0,
    diedAt: null,
    deathCause: null,
    ...overrides,
  });
}

export function careRequest(type: string, overrides: Partial<ApplyCareActionRequest> = {}): ApplyCareActionRequest {
  return {
    actionId: '33333333-3333-4333-8333-333333333333',
    petId: PET_ID,
    ownerId: OWNER_ID,
    type,
    hungerDelta: 0,
    happinessDelta: 0,
    weightDelta: 0,
    curesSickness: false,
    ...overrides,
  };
}
