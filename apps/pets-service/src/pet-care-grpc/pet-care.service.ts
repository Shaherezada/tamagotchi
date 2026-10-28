import { OutboxService } from '@app/common';
import type { ApplyCareActionRequest, GetPetSnapshotRequest, PetSnapshot } from '@app/contracts';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { GameRules } from '../lifecycle/game-rules';
import { lockedPets, saveSimulation } from '../lifecycle/pet-store';
import { Simulation } from '../lifecycle/simulation';
import { AppliedCareAction } from '../pets/entities/applied-care-action.entity';
import { Pet } from '../pets/entities/pet.entity';
import { CareRejectedError, CareRules } from './care-rules';

/**
 * Уход по gRPC от care-service. Ошибки – RpcException с кодом gRPC (§5): NOT_FOUND – нет питомца
 * или он чужой, FAILED_PRECONDITION – спит, ещё яйцо или умер.
 */
@Injectable()
export class PetCareService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rules: GameRules,
    private readonly outbox: OutboxService,
  ) {}

  /** Питомец, applied_care_actions и хронология – одной транзакцией; повтор actionId вернёт прежний результат. */
  async apply(request: ApplyCareActionRequest): Promise<PetSnapshot> {
    if (!isUUID(request.actionId)) {
      throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'actionId должен быть UUID' });
    }
    if (!isUUID(request.petId)) {
      throw notFound(request.petId);
    }
    const outcome = await this.dataSource.transaction(async (manager) => {
      // блокировка питомца упорядочивает уход и тик, а заодно повторы одного actionId
      const pet = await lockedPets(manager).where('pet.id = :petId', { petId: request.petId }).getOne();
      if (!pet || pet.ownerId !== request.ownerId) {
        throw notFound(request.petId);
      }
      const applied = await manager.findOne(AppliedCareAction, {
        where: { actionId: request.actionId, pet: { id: pet.id } },
      });
      if (applied) {
        return { snapshot: applied.result };
      }
      // сначала питомец доживает до текущего момента: уход применяется к актуальному состоянию
      const now = new Date();
      const lived = Simulation.simulate(pet, now, this.rules, Math.random);
      await saveSimulation(manager, this.outbox, lived);
      let care;
      try {
        care = CareRules.applyCare(lived.pet, request, now);
      } catch (error) {
        if (error instanceof CareRejectedError) {
          // доживание сохраняется, отказ – после коммита
          return { rejected: error };
        }
        throw error;
      }
      // зов мог закрыться или смениться: ближайший тик пересчитает следующее событие
      care.pet.nextTickAt = now;
      await saveSimulation(manager, this.outbox, care);
      const snapshot = toSnapshot(care.pet, care.mistake);
      await manager.insert(AppliedCareAction, {
        actionId: request.actionId,
        pet: care.pet,
        type: request.type,
        result: snapshot,
        appliedAt: now,
      });
      return { snapshot };
    });
    if (outcome.rejected) {
      const code = outcome.rejected.reason === 'UNKNOWN_TYPE' ? status.INVALID_ARGUMENT : status.FAILED_PRECONDITION;
      throw new RpcException({ code, message: outcome.rejected.message });
    }
    return outcome.snapshot;
  }

  async snapshot(request: GetPetSnapshotRequest): Promise<PetSnapshot> {
    const pet = isUUID(request.petId)
      ? await this.dataSource.getRepository(Pet).findOne({
          where: { id: request.petId, ownerId: request.ownerId },
          relations: { form: true },
        })
      : null;
    if (!pet) {
      throw notFound(request.petId);
    }
    return toSnapshot(pet, false);
  }
}

function notFound(petId: string): RpcException {
  return new RpcException({ code: status.NOT_FOUND, message: `Питомец ${petId} не найден` });
}

export function toSnapshot(pet: Pet, careMistakeMade: boolean): PetSnapshot {
  return {
    petId: pet.id,
    name: pet.name,
    stage: pet.stage,
    formCode: pet.form.code,
    hunger: pet.hunger,
    happiness: pet.happiness,
    discipline: pet.discipline,
    weight: pet.weight,
    poopCount: pet.poopCount,
    isSick: pet.isSick,
    isSleeping: pet.isSleeping,
    careMistakes: pet.careMistakes,
    careMistakeMade,
  };
}
