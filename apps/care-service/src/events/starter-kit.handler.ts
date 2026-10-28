import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey, type UserRegistered } from '@app/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { Item } from '../items/item.entity';
import { Reason } from '../wallet/reason.enum';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';
import { WalletService } from '../wallet/wallet.service';
import { STARTER_COINS, STARTER_ITEMS } from './rewards';

/** user.registered: кошелёк со 100 монетами и стартовый набор – в транзакции inbox. */
@Injectable()
@EventConsumer()
export class StarterKitHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.UserRegistered];
  private readonly logger = new Logger(StarterKitHandler.name);

  constructor(
    private readonly wallet: WalletService,
    private readonly inventory: InventoryService,
  ) {}

  async handle(envelope: EventEnvelope, manager: EntityManager): Promise<void> {
    const { userId } = envelope.payload as UserRegistered;
    // повтор того же eventId отсекает inbox; здесь – защита от второго события о том же игроке
    const given = await manager.findOne(WalletTransaction, {
      where: { wallet: { userId }, reason: Reason.STARTER_KIT },
    });
    if (given) {
      this.logger.log(`Стартовый набор игроку ${userId} уже выдан`);
      return;
    }
    const items = await manager.find(Item, { where: { code: In(STARTER_ITEMS.map((s) => s.code)) } });
    const missing = STARTER_ITEMS.filter((s) => !items.some((item) => item.code === s.code));
    if (missing.length > 0) {
      // без сида набор неполный – ошибка, событие повторится и уйдёт в DLQ, а не потеряется
      throw new Error(`Нет предметов стартового набора: ${missing.map((s) => s.code).join(', ')}`);
    }
    await this.wallet.credit(manager, {
      userId,
      amount: STARTER_COINS,
      reason: Reason.STARTER_KIT,
      referenceId: envelope.eventId,
    });
    for (const { code, quantity } of STARTER_ITEMS) {
      const item = items.find((i) => i.code === code)!;
      await this.inventory.add(manager, { userId, itemId: item.id, quantity });
    }
  }
}
