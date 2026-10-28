import { runMigrationsCli } from '@app/common';
import { USERS_SCHEMA } from './database';
import { USERS_ENV_PREFIX, UsersEnv } from './users-env';

runMigrationsCli(UsersEnv, USERS_ENV_PREFIX, USERS_SCHEMA);
