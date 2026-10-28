import type { OutboxService } from '@app/common';
import type { EntityManager } from 'typeorm';
import { PetEvent } from '../pets/entities/pet-event.entity';
import { Pet } from '../pets/entities/pet.entity';
import type { SimulationResult } from './simulation';

/**
 * Питомец с формой под блокировкой строки pets (FOR UPDATE OF pet: строку справочника форм не блокируем,
 * иначе питомцы одной формы мешали бы друг другу). skipLocked – для планировщика: занятых не ждать.
 */
export function lockedPets(manager: EntityManager, skipLocked = false) {
  const query = manager
    .getRepository(Pet)
    .createQueryBuilder('pet')
    .innerJoinAndSelect('pet.form', 'form')
    .setLock('pessimistic_write', undefined, ['pet']);
  return skipLocked ? query.setOnLocked('skip_locked') : query;
}

/** Состояние, хронология и события – в транзакции manager (§7: тик питомца – одна транзакция). */
export async function saveSimulation(
  manager: EntityManager,
  outbox: OutboxService,
  result: Pick<SimulationResult, 'pet' | 'history'> & Partial<Pick<SimulationResult, 'events'>>,
): Promise<void> {
  await manager.save(Pet, result.pet);
  if (result.history.length > 0) {
    await manager.insert(PetEvent, result.history);
  }
  for (const envelope of result.events ?? []) {
    await outbox.add(manager, envelope);
  }
}
