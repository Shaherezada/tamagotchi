import { runSeedCli } from '@app/common';
import { PETS_SCHEMA } from './database';
import { PetForm } from './pets/entities/pet-form.entity';
import { PET_FORMS, petFormImageKey } from './pets/pet-forms.catalog';
import { PETS_ENV_PREFIX, PetsEnv } from './pets-env';

/** Сид pets_db: справочник форм; повторный запуск обновляет названия и описания. */
runSeedCli(PetsEnv, PETS_ENV_PREFIX, PETS_SCHEMA, async (dataSource, _env, logger) => {
  const forms = PET_FORMS.map((form) => ({ ...form, imageKey: petFormImageKey(form.code) }));
  await dataSource.getRepository(PetForm).upsert(forms, ['code']);
  logger.log(`Формы питомца: ${forms.length}`);
});
