import { runMigrationsCli } from '@app/common';
import { PETS_SCHEMA } from './database';
import { PETS_ENV_PREFIX, PetsEnv } from './pets-env';

runMigrationsCli(PetsEnv, PETS_ENV_PREFIX, PETS_SCHEMA);
