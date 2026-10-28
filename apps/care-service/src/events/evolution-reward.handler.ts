import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, type PetEvolved, RoutingKey } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Reason } from '../wallet/reason.enum';
import { WalletService } from '../wallet/wallet.service';
import { EVOLUTION_REWARDS } from './rewards';

/** pet.evolved: награда монетами за стадии ADULT и ELDER – в транзакции inbox. */
@Injectable()
@EventConsumer()
export class EvolutionRewardHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.PetEvolved];

  constructor(private readonly wallet: WalletService) {}

  async handle(envelope: EventEnvelope, manager: EntityManager): Promise<void> {
    const { petId, ownerId, toStage } = envelope.payload as PetEvolved;
    const amount = EVOLUTION_REWARDS[toStage];
    if (!amount) {
      return;
    }
    await this.wallet.credit(manager, {
      userId: ownerId,
      amount,
      reason: Reason.EVOLUTION_REWARD,
      referenceId: petId,
    });
  }
}
