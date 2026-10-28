import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey } from '@app/contracts';
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

/** user.registered: приветствие новому игроку. */
@Injectable()
@EventConsumer()
export class WelcomeHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.UserRegistered];

  constructor(private readonly notifications: NotificationsService) {}

  handle(_envelope: EventEnvelope, _manager: EntityManager): Promise<void> {
    throw new NotImplementedException();
  }
}
