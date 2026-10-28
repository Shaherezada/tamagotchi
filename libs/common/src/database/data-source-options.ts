import type { DataSourceOptions, MixedList } from 'typeorm';
import type { BaseEnv } from '../config/base-env';

/* eslint-disable @typescript-eslint/no-unsafe-function-type -- так TypeORM принимает списки классов */
export interface DatabaseSchema {
  entities: MixedList<Function>;
  migrations: MixedList<Function>;
}
/* eslint-enable @typescript-eslint/no-unsafe-function-type */

/** Подключение к своей базе сервиса: схема меняется только миграциями (synchronize: false). */
export function dataSourceOptions(env: BaseEnv, schema: DatabaseSchema): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    entities: schema.entities,
    migrations: schema.migrations,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    migrationsRun: env.DB_MIGRATIONS_RUN,
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
  };
}
