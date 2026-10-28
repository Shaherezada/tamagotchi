import { runMigrationsCli } from '@app/common';
import { CARE_ENV_PREFIX, CareEnv } from './care-env';
import { CARE_SCHEMA } from './database';

runMigrationsCli(CareEnv, CARE_ENV_PREFIX, CARE_SCHEMA);
