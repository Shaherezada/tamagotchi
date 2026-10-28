import { runSeedCli } from '@app/common';
import { CARE_ENV_PREFIX, CareEnv } from './care-env';
import { CARE_SCHEMA } from './database';
import { Item } from './items/item.entity';
import { ITEMS } from './items/items.catalog';

/** Сид care_db: каталог предметов по коду; иконку и признак isActive повторный запуск не трогает. */
runSeedCli(CareEnv, CARE_ENV_PREFIX, CARE_SCHEMA, async (dataSource, _env, logger) => {
  await dataSource.getRepository(Item).upsert(ITEMS, ['code']);
  logger.log(`Предметы каталога: ${ITEMS.length}`);
});
