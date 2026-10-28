import type { ApplyCareActionRequest } from '@app/contracts';
import { clonePet, historyRow, refreshNeeds } from '../lifecycle/simulation';
import { MAX_DISCIPLINE, MAX_HEARTS, MAX_WEIGHT, MIN_WEIGHT, SCOLD_DISCIPLINE } from '../lifecycle/game-rules';
import type { PetEvent } from '../pets/entities/pet-event.entity';
import type { Pet } from '../pets/entities/pet.entity';
import { Attention, CareMistakeReason, CareType, PetEventType, Stage } from '../pets/pet-enums';

export interface CareOutcome {
  pet: Pet;
  /** Этим действием допущена ошибка ухода (кормить сытого, лечить здорового, ругать без каприза). */
  mistake: boolean;
  history: PetEvent[];
}

/** Почему уход не применён: DEAD, EGG, SLEEPING – FAILED_PRECONDITION, UNKNOWN_TYPE – INVALID_ARGUMENT. */
export type CareRejectReason = 'DEAD' | 'EGG' | 'SLEEPING' | 'UNKNOWN_TYPE';

export class CareRejectedError extends Error {
  constructor(
    readonly reason: CareRejectReason,
    message: string,
  ) {
    super(message);
  }
}

/** Чистые правила применения ухода (§8–9): не трогают БД. */
export class CareRules {
  static applyCare(source: Pet, request: ApplyCareActionRequest, now: Date): CareOutcome {
    const type = request.type as CareType;
    if (!Object.values(CareType).includes(type)) {
      throw new CareRejectedError('UNKNOWN_TYPE', `Неизвестное действие ухода ${request.type}`);
    }
    if (source.diedAt) {
      throw new CareRejectedError('DEAD', 'Питомец умер');
    }
    if (source.stage === Stage.EGG) {
      throw new CareRejectedError('EGG', 'Питомец ещё не вылупился');
    }
    // спящего можно только разбудить, включив свет
    if (source.isSleeping && type !== CareType.LIGHTS_ON) {
      throw new CareRejectedError('SLEEPING', 'Питомец спит: сначала включите свет');
    }

    const pet = clonePet(source);
    const mistake = mistakeOf(pet, type);
    pet.hunger = clamp(pet.hunger + request.hungerDelta, 0, MAX_HEARTS);
    pet.happiness = clamp(pet.happiness + request.happinessDelta, 0, MAX_HEARTS);
    pet.weight = clamp(pet.weight + request.weightDelta, MIN_WEIGHT, MAX_WEIGHT);
    if (request.curesSickness) {
      pet.isSick = false;
    }
    switch (type) {
      case CareType.CLEAN:
        pet.poopCount = 0;
        break;
      case CareType.SCOLD:
        if (!mistake) {
          pet.discipline = Math.min(MAX_DISCIPLINE, pet.discipline + SCOLD_DISCIPLINE);
          pet.attention = null;
        }
        break;
      case CareType.LIGHTS_OFF:
        pet.isSleeping = true;
        break;
      case CareType.LIGHTS_ON:
        pet.isSleeping = false;
        break;
      default:
        break;
    }

    const history = [historyRow(pet, PetEventType.CARE, { actionId: request.actionId, type }, now)];
    if (mistake) {
      pet.careMistakes += 1;
      history.push(historyRow(pet, PetEventType.CARE_MISTAKE, { reason: mistake, actionId: request.actionId }, now));
    }
    refreshNeeds(pet, now);
    return { pet, mistake: mistake !== null, history };
  }
}

/** Ошибка ухода самим действием (§8): кормить сытого, лечить здорового, ругать без каприза. */
function mistakeOf(pet: Pet, type: CareType): CareMistakeReason | null {
  if (type === CareType.FEED && pet.hunger >= MAX_HEARTS) {
    return CareMistakeReason.OVERFED;
  }
  if (type === CareType.HEAL && !pet.isSick) {
    return CareMistakeReason.NEEDLESS_HEAL;
  }
  if (type === CareType.SCOLD && pet.attention !== Attention.MISBEHAVING) {
    return CareMistakeReason.NEEDLESS_SCOLD;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
