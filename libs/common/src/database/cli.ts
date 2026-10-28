import { Logger, Type } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { BaseEnv } from '../config/base-env';
import { loadEnv } from '../config/load-env';
import { dataSourceOptions, DatabaseSchema } from './data-source-options';

/** Открывает базу сервиса без Nest, выполняет работу и закрывает соединение (миграции, сид). */
export async function withDataSource<E extends BaseEnv, R>(
  envClass: Type<E>,
  prefix: string,
  schema: DatabaseSchema,
  work: (dataSource: DataSource, env: E) => Promise<R>,
): Promise<R> {
  const env = loadEnv(envClass, prefix);
  const dataSource = new DataSource({ ...dataSourceOptions(env, schema), migrationsRun: false });
  await dataSource.initialize();
  try {
    return await work(dataSource, env);
  } finally {
    await dataSource.destroy();
  }
}

/** Точка входа скрипта миграций: `node dist/.../migrate.js`. */
export function runMigrationsCli<E extends BaseEnv>(envClass: Type<E>, prefix: string, schema: DatabaseSchema): void {
  const logger = new Logger('migrate');
  withDataSource(envClass, prefix, schema, async (dataSource) => {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    logger.log(applied.length ? `Применены: ${applied.map((m) => m.name).join(', ')}` : 'Новых миграций нет');
  }).catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

/** Точка входа сид-скрипта: `node dist/.../seed.js`. */
export function runSeedCli<E extends BaseEnv>(
  envClass: Type<E>,
  prefix: string,
  schema: DatabaseSchema,
  seed: (dataSource: DataSource, env: E, logger: Logger) => Promise<void>,
): void {
  const logger = new Logger('seed');
  withDataSource(envClass, prefix, schema, (dataSource, env) => seed(dataSource, env, logger)).catch(
    (error: unknown) => {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
