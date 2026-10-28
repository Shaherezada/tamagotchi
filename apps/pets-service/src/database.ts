import { type DatabaseSchema, OutboxMessage } from '@app/common';
import { PETS_MIGRATIONS } from '../migrations';
import { AppliedCareAction } from './pets/entities/applied-care-action.entity';
import { PetEvent } from './pets/entities/pet-event.entity';
import { PetForm } from './pets/entities/pet-form.entity';
import { Pet } from './pets/entities/pet.entity';

export const PETS_SCHEMA: DatabaseSchema = {
  entities: [Pet, PetForm, PetEvent, AppliedCareAction, OutboxMessage],
  migrations: PETS_MIGRATIONS,
};
