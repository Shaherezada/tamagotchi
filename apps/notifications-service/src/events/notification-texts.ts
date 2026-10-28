import {
  type EventEnvelope,
  type PetDied,
  type PetEventBase,
  type PetEvolved,
  RoutingKey,
  type UserRegistered,
} from '@app/contracts';
import type { NewNotification } from '../notifications/new-notification';
import { NotificationType } from '../notifications/notification-type.enum';

const STAGE_TITLES: Record<string, string> = {
  EGG: 'яйцо',
  BABY: 'малыш',
  CHILD: 'ребёнок',
  TEEN: 'подросток',
  ADULT: 'взрослый',
  ELDER: 'старейшина',
};

const DEATH_CAUSES: Record<string, string> = {
  NEGLECT: 'от голода и болезни без ухода',
  OLD_AGE: 'от старости',
};

/** Тексты уведомлений по событиям (чистые функции). */
export class NotificationTexts {
  static welcome(event: UserRegistered): NewNotification {
    return {
      userId: event.userId,
      type: NotificationType.WELCOME,
      title: 'Добро пожаловать!',
      body: `${event.nickname}, заведите первого питомца – он вылупится из яйца и будет ждать вашей заботы`,
    };
  }

  /** pet.hungry, pet.sick, pet.evolved, pet.died → уведомление владельцу. */
  static forPet(envelope: EventEnvelope): NewNotification {
    const pet = envelope.payload as PetEventBase;
    const base = { userId: pet.ownerId, petId: pet.petId };
    switch (envelope.type) {
      case RoutingKey.PetHungry:
        return {
          ...base,
          type: NotificationType.PET_HUNGRY,
          title: 'Питомец голоден',
          body: `${pet.petName} давно ничего не ел – покормите его`,
        };
      case RoutingKey.PetSick:
        return {
          ...base,
          type: NotificationType.PET_SICK,
          title: 'Питомец заболел',
          body: `${pet.petName} заболел – дайте ему лекарство`,
        };
      case RoutingKey.PetEvolved: {
        const stage = (pet as PetEvolved).toStage;
        return {
          ...base,
          type: NotificationType.PET_EVOLVED,
          title: 'Питомец вырос',
          body: `${pet.petName} вырос, теперь он ${STAGE_TITLES[stage] ?? stage}`,
        };
      }
      case RoutingKey.PetDied: {
        const { cause, ageDays } = pet as PetDied;
        const reason = DEATH_CAUSES[cause] ? ` ${DEATH_CAUSES[cause]}` : '';
        return {
          ...base,
          type: NotificationType.PET_DIED,
          title: 'Питомец умер',
          body: `${pet.petName} умер${reason}, прожив дней: ${ageDays}`,
        };
      }
      default:
        throw new Error(`Нет текста уведомления для события ${envelope.type}`);
    }
  }
}
