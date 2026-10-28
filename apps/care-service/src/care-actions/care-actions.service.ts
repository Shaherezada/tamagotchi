import { ProblemException } from '@app/common';
import type { PetSnapshot } from '@app/contracts';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Category } from '../items/category.enum';
import { Item } from '../items/item.entity';
import { Reason } from '../wallet/reason.enum';
import { WalletService } from '../wallet/wallet.service';
import { CareAction } from './care-action.entity';
import { CareStatus, CareType } from './care-enums';
import { CareActionDto } from './dto/care-action.dto';
import { CareActionsQuery } from './dto/care-actions-query.dto';
import { CareResultDto } from './dto/care-result.dto';
import { CreateCareActionDto } from './dto/create-care-action.dto';
import { PetCareClient, type PetCareRejection, toPetCareRejection } from './pet-care.client';

/** Награда за игру, если настроение действительно выросло (§9). */
export const PLAY_REWARD_COINS = 5;

/** После стольких вызовов pets-service без ответа действие отклоняется, предмет возвращается (§9). */
export const MAX_CARE_ATTEMPTS = 5;

/** Какой категории предмет нужен действию (§9); остальные действия – без предмета. */
export const CARE_ITEM_CATEGORY: Partial<Record<CareType, Category>> = {
  [CareType.FEED]: Category.FOOD,
  [CareType.SNACK]: Category.SNACK,
  [CareType.HEAL]: Category.MEDICINE,
  [CareType.PLAY]: Category.TOY,
};

/** Итог вызова pets-service: принят, окончательный отказ или нет ответа. */
type PetsOutcome =
  | { kind: 'applied'; pet: PetSnapshot; rewarded: boolean }
  | { kind: 'rejected'; rejection: PetCareRejection }
  | { kind: 'unavailable' };

const PETS_UNAVAILABLE: PetCareRejection = {
  status: HttpStatus.CONFLICT,
  reason: 'PETS_UNAVAILABLE',
  detail: `pets-service не ответил за ${MAX_CARE_ATTEMPTS} попыток`,
};

/**
 * Сага ухода (§9): списать предмет и записать PENDING, вызвать pets-service, затем APPLIED
 * или компенсация (вернуть предмет, REJECTED); недоступен pets-service – 503, действие остаётся PENDING.
 */
@Injectable()
export class CareActionsService {
  private readonly logger = new Logger(CareActionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly wallet: WalletService,
    private readonly pets: PetCareClient,
  ) {}

  async perform(userId: string, dto: CreateCareActionDto): Promise<CareResultDto> {
    const category = CARE_ITEM_CATEGORY[dto.type];
    if (category && !dto.itemId) {
      throw ProblemException.badRequest(
        'Нужен предмет',
        `Для ${dto.type} укажите itemId предмета ${category}`,
        'item-required',
      );
    }
    if (!category && dto.itemId) {
      throw ProblemException.badRequest('Предмет не нужен', `${dto.type} выполняется без предмета`, 'item-not-allowed');
    }

    // шаг 1: предмет списан и действие PENDING – одной транзакцией
    const action = await this.dataSource.transaction(async (manager) => {
      const item = dto.itemId ? await this.reserveItem(manager, userId, dto.itemId, category!) : null;
      return manager.save(CareAction, {
        userId,
        petId: dto.petId,
        type: dto.type,
        item,
        status: CareStatus.PENDING,
        attempts: 1,
        result: null,
        rejectReason: null,
        completedAt: null,
      });
    });

    // шаг 2: эффект в pets-service, шаг 3: итог или компенсация
    const outcome = await this.callPets(action);
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(CareAction, {
        where: { id: action.id },
        lock: { mode: 'pessimistic_write' },
      });
      await this.complete(manager, Object.assign(locked!, { item: action.item }), outcome);
      Object.assign(action, locked);
    });

    if (action.status === CareStatus.APPLIED) {
      return { action: toCareActionDto(action), pet: action.result! };
    }
    if (action.status === CareStatus.REJECTED) {
      const rejection: PetCareRejection =
        outcome.kind === 'rejected'
          ? outcome.rejection
          : { status: HttpStatus.CONFLICT, reason: action.rejectReason ?? '', detail: 'Действие отклонено' };
      throw careRejected(rejection);
    }
    throw new ProblemException({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      type: 'pets-unavailable',
      title: 'Сервис питомцев временно недоступен',
      detail: `Действие ${action.id} осталось PENDING и будет повторено автоматически`,
    });
  }

  async list(userId: string, query: CareActionsQuery): Promise<CareActionDto[]> {
    if (query.petId) {
      await this.checkPet(userId, query.petId);
    }
    const actions = await this.dataSource.getRepository(CareAction).find({
      where: { userId, ...(query.petId ? { petId: query.petId } : {}) },
      relations: { item: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: query.limit,
    });
    return actions.map(toCareActionDto);
  }

  /**
   * Повтор зависшего действия с тем же actionId; после 5 попыток – вернуть предмет и REJECTED.
   * Строка заблокирована на весь повтор (SKIP LOCKED): другой экземпляр сервиса её не возьмёт.
   */
  async retry(action: CareAction): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(CareAction, {
        where: { id: action.id, status: CareStatus.PENDING },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (!locked) {
        return;
      }
      locked.item = action.item;
      if (locked.attempts >= MAX_CARE_ATTEMPTS) {
        await this.complete(manager, locked, { kind: 'rejected', rejection: PETS_UNAVAILABLE });
        return;
      }
      locked.attempts += 1;
      let outcome = await this.callPets(locked);
      if (outcome.kind === 'unavailable' && locked.attempts >= MAX_CARE_ATTEMPTS) {
        outcome = { kind: 'rejected', rejection: PETS_UNAVAILABLE };
      }
      await this.complete(manager, locked, outcome);
      this.logger.log(`Досылка ${locked.id}: попытка ${locked.attempts}, ${locked.status}`);
    });
  }

  /** Предмет нужной категории есть у игрока; расходуемый списывается (строка инвентаря FOR UPDATE). */
  private async reserveItem(manager: EntityManager, userId: string, itemId: string, category: Category): Promise<Item> {
    const item = await manager.findOne(Item, { where: { id: itemId } });
    if (!item) {
      throw ProblemException.notFound('Предмет не найден', `Нет предмета ${itemId}`, 'item-not-found');
    }
    if (item.category !== category) {
      throw ProblemException.conflict(
        'item-not-suitable',
        'Предмет не подходит к действию',
        `Нужен предмет ${category}, а ${item.code} – ${item.category}`,
      );
    }
    if (item.isConsumable) {
      await this.inventory.take(manager, { userId, itemId, quantity: 1 });
      return item;
    }
    const owned = await manager.findOne(InventoryItem, { where: { userId, itemId } });
    if (!owned || owned.quantity < 1) {
      throw ProblemException.conflict(
        'item-not-in-inventory',
        'Предмета нет в инвентаре',
        `${item.code} нет в инвентаре`,
      );
    }
    return item;
  }

  private async callPets(action: CareAction): Promise<PetsOutcome> {
    const item = action.item;
    try {
      // настроение до игры – для награды; при повторе уже применённой игры награды не будет
      const before =
        action.type === CareType.PLAY
          ? await this.pets.snapshot({ petId: action.petId, ownerId: action.userId })
          : null;
      const pet = await this.pets.apply({
        actionId: action.id,
        petId: action.petId,
        ownerId: action.userId,
        type: action.type,
        hungerDelta: item?.hungerDelta ?? 0,
        happinessDelta: item?.happinessDelta ?? 0,
        weightDelta: item?.weightDelta ?? 0,
        curesSickness: item?.curesSickness ?? false,
      });
      return { kind: 'applied', pet, rewarded: before !== null && pet.happiness > before.happiness };
    } catch (error) {
      const rejection = toPetCareRejection(error);
      if (rejection) {
        return { kind: 'rejected', rejection };
      }
      this.logger.warn(`pets-service не ответил на действие ${action.id}: ${(error as Error)?.message ?? error}`);
      return { kind: 'unavailable' };
    }
  }

  /** Итог саги в транзакции вызывающего; строка уже заблокирована, завершённое действие не трогается. */
  private async complete(manager: EntityManager, action: CareAction, outcome: PetsOutcome): Promise<void> {
    if (action.status !== CareStatus.PENDING) {
      return;
    }
    if (outcome.kind === 'applied') {
      action.status = CareStatus.APPLIED;
      action.result = outcome.pet;
      action.completedAt = new Date();
      if (outcome.rewarded) {
        await this.wallet.credit(manager, {
          userId: action.userId,
          amount: PLAY_REWARD_COINS,
          reason: Reason.PLAY_REWARD,
          referenceId: action.id,
        });
      }
    } else if (outcome.kind === 'rejected') {
      // компенсация: расходуемый предмет возвращается
      if (action.item?.isConsumable) {
        await this.inventory.add(manager, { userId: action.userId, itemId: action.item.id, quantity: 1 });
      }
      action.status = CareStatus.REJECTED;
      action.rejectReason = outcome.rejection.reason;
      action.completedAt = new Date();
    }
    const { item: _item, ...columns } = action;
    await manager.save(CareAction, columns);
  }

  /** Чужой или несуществующий питомец – 404; pets-service недоступен – история отдаётся без проверки. */
  private async checkPet(userId: string, petId: string): Promise<void> {
    try {
      await this.pets.snapshot({ petId, ownerId: userId });
    } catch (error) {
      if (toPetCareRejection(error)?.status === HttpStatus.NOT_FOUND) {
        throw ProblemException.notFound('Питомец не найден', `Нет питомца ${petId}`, 'pet-not-found');
      }
    }
  }
}

function careRejected(rejection: PetCareRejection): ProblemException {
  if (rejection.status === HttpStatus.NOT_FOUND) {
    return ProblemException.notFound('Питомец не найден', rejection.detail, 'pet-not-found');
  }
  if (rejection.status === HttpStatus.BAD_REQUEST) {
    return ProblemException.badRequest('Некорректное действие ухода', rejection.detail, 'care-invalid');
  }
  return ProblemException.conflict('care-rejected', 'Питомец не может принять уход', rejection.detail);
}

export function toCareActionDto(action: CareAction): CareActionDto {
  return {
    id: action.id,
    petId: action.petId,
    type: action.type,
    itemId: action.item?.id ?? null,
    status: action.status,
    rejectReason: action.rejectReason,
    createdAt: action.createdAt,
  };
}
