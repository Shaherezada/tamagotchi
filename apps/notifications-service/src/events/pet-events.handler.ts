import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTexts } from './notification-texts';

/** pet.hungry, pet.sick, pet.evolved, pet.died: уведомление владельцу питомца. */
@Injectable()
@EventConsumer()
export class PetEventsHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.PetHungry, RoutingKey.PetSick, RoutingKey.PetEvolved, RoutingKey.PetDied];

  constructor(private readonly notifications: NotificationsService) {}

  handle(envelope: EventEnvelope, manager: EntityManager): Promise<void> {
    return this.notifications.notify(manager, NotificationTexts.forPet(envelope));
  }
}
