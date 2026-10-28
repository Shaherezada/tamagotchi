import { OutboxService, ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PetDto } from '../pets/dto/pet.dto';
import { toPetDto } from '../pets/pet.mapper';
import { PetsEnv } from '../pets-env';
import { gameMinutesToMs, GameRules } from './game-rules';
import { lockedPets, saveSimulation } from './pet-store';
import { Simulation } from './simulation';

@Injectable()
export class LifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly rules: GameRules,
    private readonly env: PetsEnv,
  ) {}

  /**
   * Тик: до limit живых питомцев с next_tick_at <= now() через FOR UPDATE SKIP LOCKED, simulate,
   * питомец, хронология и outbox – одной транзакцией. Возвращает число обработанных питомцев.
   */
  processDue(limit: number): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const pets = await lockedPets(manager, true)
        .where('pet.diedAt IS NULL')
        .andWhere('pet.nextTickAt <= :now', { now })
        .orderBy('pet.nextTickAt', 'ASC')
        .limit(limit)
        .getMany();
      for (const pet of pets) {
        await saveSimulation(manager, this.outbox, Simulation.simulate(pet, now, this.rules, Math.random));
      }
      return pets.length;
    });
  }

  /** Перемотка для демонстрации (только DEMO_MODE): сдвиг отметок времени назад и сразу simulate. */
  async timeTravel(petId: string, minutes: number): Promise<PetDto> {
    if (!this.env.DEMO_MODE) {
      throw ProblemException.forbidden('Перемотка времени доступна только при DEMO_MODE=true');
    }
    const pet = await this.dataSource.transaction(async (manager) => {
      const found = await lockedPets(manager).where('pet.id = :petId', { petId }).getOne();
      if (!found) {
        throw ProblemException.notFound('Питомец не найден', undefined, 'pet-not-found');
      }
      if (found.diedAt) {
        return found;
      }
      const shift = gameMinutesToMs(this.rules, minutes);
      const back = (date: Date): Date => new Date(date.getTime() - shift);
      found.bornAt = back(found.bornAt);
      found.stageSince = back(found.stageSince);
      found.simulatedAt = back(found.simulatedAt);
      found.nextTickAt = back(found.nextTickAt);
      found.attentionSince = found.attentionSince && back(found.attentionSince);
      found.starvingSince = found.starvingSince && back(found.starvingSince);
      // прожитая хронология уезжает вместе с питомцем, иначе новые записи окажутся раньше старых
      await manager.query(
        "UPDATE pet_events SET occurred_at = occurred_at - $2 * interval '1 millisecond' WHERE pet_id = $1",
        [found.id, shift],
      );
      const result = Simulation.simulate(found, new Date(), this.rules, Math.random);
      await saveSimulation(manager, this.outbox, result);
      return result.pet;
    });
    return toPetDto(pet, this.env);
  }
}
