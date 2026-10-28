import type { NotificationType } from './notification-type.enum';

/** Уведомление, которое нужно сохранить и отправить в поток. */
export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  petId?: string;
}
