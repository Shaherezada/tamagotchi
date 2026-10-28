import type { SwaggerOptions } from '@app/common';

export const USERS_TAG = 'users-service';

export const USERS_SWAGGER: SwaggerOptions = {
  service: USERS_TAG,
  docsName: 'users',
  title: 'users-service – пользователи',
  description: 'Регистрация, вход и выход, выпуск JWT RS256, профиль игрока',
};
