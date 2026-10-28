import { BaseEnv } from '@app/common';
import { IsNotEmpty, IsString } from 'class-validator';

export const USERS_ENV_PREFIX = 'USERS';

export class UsersEnv extends BaseEnv {
  /** Закрытый ключ RS256: токены подписывает только users-service. */
  @IsString()
  @IsNotEmpty()
  JWT_PRIVATE_KEY_FILE: string;
}
