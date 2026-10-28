import type { PetEventBase } from './pet-event';

/** pet.evolved: pets → notifications, care (награда за ADULT и ELDER). */
export interface PetEvolved extends PetEventBase {
  fromStage: string;
  toStage: string;
  formCode: string;
  careMistakes: number;
}
