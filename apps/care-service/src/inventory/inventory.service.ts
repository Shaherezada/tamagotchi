import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { InventoryItemDto } from './dto/inventory-item.dto';
import type { InventoryChange } from './inventory-change';
import { InventoryItem } from './inventory-item.entity';

@Injectable()
export class InventoryService {
  constructor(@InjectRepository(InventoryItem) private readonly inventory: Repository<InventoryItem>) {}

  list(_userId: string): Promise<InventoryItemDto[]> {
    throw new NotImplementedException();
  }

  /** Пополнение в транзакции вызывающего (покупка, стартовый набор, возврат предмета). */
  add(_manager: EntityManager, _change: InventoryChange): Promise<void> {
    throw new NotImplementedException();
  }

  /** Списание в транзакции вызывающего: строка FOR UPDATE; нет предмета – 409. */
  take(_manager: EntityManager, _change: InventoryChange): Promise<void> {
    throw new NotImplementedException();
  }
}
