import { EventConsumer, type EventHandler } from '@app/common';
import { type EventEnvelope, RoutingKey, type UserRegistered } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTexts } from './notification-texts';

/** user.registered: приветствие новому игроку. */
@Injectable()
@EventConsumer()
export class WelcomeHandler implements EventHandler {
  readonly routingKeys = [RoutingKey.UserRegistered];

  constructor(private readonly notifications: NotificationsService) {}

  handle(envelope: EventEnvelope, manager: EntityManager): Promise<void> {
    return this.notifications.notify(manager, NotificationTexts.welcome(envelope.payload as UserRegistered));
  }
}
