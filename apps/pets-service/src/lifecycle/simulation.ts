import type { EventEnvelope } from '@app/contracts';
import { NotImplementedException } from '@nestjs/common';
import type { PetEvent } from '../pets/entities/pet-event.entity';
import type { Pet } from '../pets/entities/pet.entity';
import type { GameRules } from './game-rules';

/** Источник случайности; в тестах подменяется детерминированным. */
export type Rng = () => number;

export interface SimulationResult {
  pet: Pet;
  history: PetEvent[];
  events: EventEnvelope[];
}

/** Чистая функция жизни питомца (§8): не трогает БД, покрывается unit-тестами. */
export class Simulation {
  static simulate(_pet: Pet, _now: Date, _rules: GameRules, _rng: Rng): SimulationResult {
    throw new NotImplementedException();
  }
}
