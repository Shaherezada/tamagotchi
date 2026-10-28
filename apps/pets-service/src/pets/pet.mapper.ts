import type { PetsEnv } from '../pets-env';
import type { PetEventDto } from './dto/pet-event.dto';
import type { PetDto } from './dto/pet.dto';
import type { PetEvent } from './entities/pet-event.entity';
import type { PetForm } from './entities/pet-form.entity';
import type { Pet } from './entities/pet.entity';

/** Публичная ссылка на объект Silo: SILO_PUBLIC_URL/бакет/ключ (бакет открыт на чтение, §12). */
export function mediaUrl(env: Pick<PetsEnv, 'SILO_PUBLIC_URL' | 'SILO_BUCKET'>, key: string): string {
  return `${env.SILO_PUBLIC_URL.replace(/\/+$/, '')}/${env.SILO_BUCKET}/${key}`;
}

export function toPetDto(pet: Pet, env: Pick<PetsEnv, 'SILO_PUBLIC_URL' | 'SILO_BUCKET'>): PetDto {
  const form: PetForm = pet.form;
  return {
    id: pet.id,
    name: pet.name,
    stage: pet.stage,
    form: { code: form.code, title: form.title, description: form.description, imageUrl: mediaUrl(env, form.imageKey) },
    hunger: pet.hunger,
    happiness: pet.happiness,
    discipline: pet.discipline,
    weight: pet.weight,
    poopCount: pet.poopCount,
    isSick: pet.isSick,
    isSleeping: pet.isSleeping,
    attention: pet.attention,
    careMistakes: pet.careMistakes,
    bornAt: pet.bornAt,
    diedAt: pet.diedAt,
    deathCause: pet.deathCause,
  };
}

export function toPetEventDto(event: PetEvent): PetEventDto {
  return { type: event.type, details: event.details, occurredAt: event.occurredAt };
}
