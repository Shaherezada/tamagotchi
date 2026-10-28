import type { PetEventBase } from './pet-event';

/** pet.sick: pets → notifications. */
export interface PetSick extends PetEventBase {
  cause: string;
}
