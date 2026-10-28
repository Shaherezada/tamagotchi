import type { ApplyCareActionRequest } from '@app/contracts';
import { NotImplementedException } from '@nestjs/common';
import type { PetEvent } from '../pets/entities/pet-event.entity';
import type { Pet } from '../pets/entities/pet.entity';

export interface CareOutcome {
  pet: Pet;
  /** Этим действием допущена ошибка ухода (кормить сытого, лечить здорового, ругать без каприза). */
  mistake: boolean;
  history: PetEvent[];
}

/** Чистые правила применения ухода (§8–9): не трогают БД. */
export class CareRules {
  static applyCare(_pet: Pet, _request: ApplyCareActionRequest, _now: Date): CareOutcome {
    throw new NotImplementedException();
  }
}
