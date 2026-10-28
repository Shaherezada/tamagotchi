import type { PetDied } from './pet-died';
import type { PetEvolved } from './pet-evolved';
import type { PetHungry } from './pet-hungry';
import type { PetSick } from './pet-sick';
import type { UserRegistered } from './user-registered';

/** Ключи маршрутизации – они же поле type конверта. */
export const RoutingKey = {
  UserRegistered: 'user.registered',
  PetHungry: 'pet.hungry',
  PetSick: 'pet.sick',
  PetEvolved: 'pet.evolved',
  PetDied: 'pet.died',
} as const;

export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

export interface EventPayloads {
  'user.registered': UserRegistered;
  'pet.hungry': PetHungry;
  'pet.sick': PetSick;
  'pet.evolved': PetEvolved;
  'pet.died': PetDied;
}
