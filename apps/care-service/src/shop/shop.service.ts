import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { Item } from '../items/item.entity';
import { Reason } from '../wallet/reason.enum';
import { WalletService } from '../wallet/wallet.service';
import { PurchaseResultDto } from './dto/purchase-result.dto';
import { PurchaseDto } from './dto/purchase.dto';
import { Purchase } from './purchase.entity';

@Injectable()
export class ShopService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly inventory: InventoryService,
  ) {}

  /** Кошелёк FOR UPDATE, списание, журнал, инвентарь, запись покупки – одной транзакцией (§7). */
  buy(userId: string, dto: PurchaseDto): Promise<PurchaseResultDto> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(Item, { where: { id: dto.itemId, isActive: true } });
      if (!item) {
        throw ProblemException.notFound(
          'Предмет не найден',
          `Предмета ${dto.itemId} нет или он снят с продажи`,
          'item-not-found',
        );
      }
      // id покупки нужен заранее: на него ссылается строка журнала
      const purchaseId = randomUUID();
      const totalPrice = item.price * dto.quantity;
      const balance = await this.wallet.debit(manager, {
        userId,
        amount: totalPrice,
        reason: Reason.PURCHASE,
        referenceId: purchaseId,
      });
      await this.inventory.add(manager, { userId, itemId: item.id, quantity: dto.quantity });
      await manager.save(Purchase, {
        id: purchaseId,
        userId,
        item: { id: item.id },
        quantity: dto.quantity,
        unitPrice: item.price,
        totalPrice,
      });
      return { purchaseId, itemId: item.id, quantity: dto.quantity, totalPrice, balance };
    });
  }
}
