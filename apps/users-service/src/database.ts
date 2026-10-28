import { type DatabaseSchema, OutboxMessage } from '@app/common';
import { USERS_MIGRATIONS } from '../migrations';
import { User } from './users/user.entity';

export const USERS_SCHEMA: DatabaseSchema = {
  entities: [User, OutboxMessage],
  migrations: USERS_MIGRATIONS,
};
