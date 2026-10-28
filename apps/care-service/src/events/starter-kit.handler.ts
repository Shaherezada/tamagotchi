import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey } from '@app/contracts';
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { WalletService } from '../wallet/wallet.service';

/** user.registered: кошелёк со 100 монетами и стартовый набор – в транзакции inbox. */
@Injectable()
@EventConsumer()
export class StarterKitHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.UserRegistered];

  constructor(
    private readonly wallet: WalletService,
    private readonly inventory: InventoryService,
  ) {}

  handle(_envelope: EventEnvelope, _manager: EntityManager): Promise<void> {
    throw new NotImplementedException();
  }
}
