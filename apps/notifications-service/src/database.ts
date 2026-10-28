import { type DatabaseSchema, ProcessedEvent } from '@app/common';
import { NOTIFICATIONS_MIGRATIONS } from '../migrations';
import { NotificationSettings } from './notifications/notification-settings.entity';
import { Notification } from './notifications/notification.entity';

export const NOTIFICATIONS_SCHEMA: DatabaseSchema = {
  entities: [Notification, NotificationSettings, ProcessedEvent],
  migrations: NOTIFICATIONS_MIGRATIONS,
};
