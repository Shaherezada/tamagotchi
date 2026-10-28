import { runMigrationsCli } from '@app/common';
import { NOTIFICATIONS_SCHEMA } from './database';
import { NOTIFICATIONS_ENV_PREFIX, NotificationsEnv } from './notifications-env';

runMigrationsCli(NotificationsEnv, NOTIFICATIONS_ENV_PREFIX, NOTIFICATIONS_SCHEMA);
