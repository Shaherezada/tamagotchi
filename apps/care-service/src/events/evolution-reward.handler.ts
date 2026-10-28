import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey } from '@app/contracts';
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { WalletService } from '../wallet/wallet.service';

/** pet.evolved: награда монетами за стадии ADULT и ELDER – в транзакции inbox. */
@Injectable()
@EventConsumer()
export class EvolutionRewardHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.PetEvolved];

  constructor(private readonly wallet: WalletService) {}

  handle(_envelope: EventEnvelope, _manager: EntityManager): Promise<void> {
    throw new NotImplementedException();
  }
}
