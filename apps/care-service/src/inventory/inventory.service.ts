import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { MoreThan, Repository } from 'typeorm';
import { IconStorage } from '../items/icon-storage';
import { toItemDto } from '../items/item.mapper';
import { InventoryItemDto } from './dto/inventory-item.dto';
import type { InventoryChange } from './inventory-change';
import { InventoryItem } from './inventory-item.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private readonly inventory: Repository<InventoryItem>,
    private readonly icons: IconStorage,
  ) {}

  async list(userId: string): Promise<InventoryItemDto[]> {
    const rows = await this.inventory.find({
      where: { userId, quantity: MoreThan(0) },
      relations: { item: true },
      order: { item: { category: 'ASC', price: 'ASC' } },
    });
    return rows.map((row) => ({ item: toItemDto(row.item, this.icons), quantity: row.quantity }));
  }

  /** Пополнение в транзакции вызывающего (покупка, стартовый набор, возврат предмета). */
  async add(manager: EntityManager, change: InventoryChange): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(InventoryItem)
      .values({ userId: change.userId, itemId: change.itemId, quantity: 0 })
      .orIgnore()
      .execute();
    const row = await this.lock(manager, change);
    row!.quantity += change.quantity;
    await manager.save(InventoryItem, row!);
  }

  /** Списание в транзакции вызывающего: строка FOR UPDATE; нет предмета – 409. */
  async take(manager: EntityManager, change: InventoryChange): Promise<void> {
    const row = await this.lock(manager, change);
    if (!row || row.quantity < change.quantity) {
      throw ProblemException.conflict(
        'item-not-in-inventory',
        'Предмета нет в инвентаре',
        `Нужно ${change.quantity} шт., в инвентаре ${row?.quantity ?? 0}`,
      );
    }
    row.quantity -= change.quantity;
    await manager.save(InventoryItem, row);
  }

  private lock(manager: EntityManager, change: InventoryChange): Promise<InventoryItem | null> {
    return manager.findOne(InventoryItem, {
      where: { userId: change.userId, itemId: change.itemId },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
