import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey } from '@app/contracts';
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

/** pet.hungry, pet.sick, pet.evolved, pet.died: уведомление владельцу питомца. */
@Injectable()
@EventConsumer()
export class PetEventsHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.PetHungry, RoutingKey.PetSick, RoutingKey.PetEvolved, RoutingKey.PetDied];

  constructor(private readonly notifications: NotificationsService) {}

  handle(_envelope: EventEnvelope, _manager: EntityManager): Promise<void> {
    throw new NotImplementedException();
  }
}
