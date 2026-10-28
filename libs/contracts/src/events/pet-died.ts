import type { PetEventBase } from './pet-event';

/** pet.died: pets → notifications. */
export interface PetDied extends PetEventBase {
  cause: string;
  ageDays: number;
}
