import type { PetEventBase } from './pet-event';

/** pet.hungry: pets → notifications. */
export interface PetHungry extends PetEventBase {
  since: string;
}
