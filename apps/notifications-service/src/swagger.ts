import type { SwaggerOptions } from '@app/common';

export const NOTIFICATIONS_TAG = 'notifications-service';

export const NOTIFICATIONS_SWAGGER: SwaggerOptions = {
  service: NOTIFICATIONS_TAG,
  docsName: 'notifications',
  title: 'notifications-service – уведомления',
  description: 'Уведомления игрока о событиях питомца: список, прочитать, удалить, настройки, живой поток SSE',
};
