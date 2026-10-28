import type { EventEnvelope, UserRegistered } from '@app/contracts';
import { NotImplementedException } from '@nestjs/common';
import type { NewNotification } from '../notifications/new-notification';

/** Тексты уведомлений по событиям (чистые функции). */
export class NotificationTexts {
  static welcome(_event: UserRegistered): NewNotification {
    throw new NotImplementedException();
  }

  /** pet.hungry, pet.sick, pet.evolved, pet.died → уведомление владельцу. */
  static forPet(_envelope: EventEnvelope): NewNotification {
    throw new NotImplementedException();
  }
}
