import { runSeedCli } from '@app/common';
import { Client } from 'minio';
import { PETS_SCHEMA } from './database';
import { PetForm } from './pets/entities/pet-form.entity';
import { renderPetFormImage } from './pets/pet-form-images';
import { PET_FORMS, petFormImageKey } from './pets/pet-forms.catalog';
import { PETS_ENV_PREFIX, PetsEnv } from './pets-env';

/**
 * Сид pets_db: справочник форм; повторный запуск обновляет названия и описания. Если заданы
 * SILO_ENDPOINT, SILO_ACCESS_KEY и SILO_SECRET_KEY – кладёт картинки форм в Silo (pet-forms/<код>.png).
 */
runSeedCli(PetsEnv, PETS_ENV_PREFIX, PETS_SCHEMA, async (dataSource, env, logger) => {
  const forms = PET_FORMS.map((form) => ({ ...form, imageKey: petFormImageKey(form.code) }));
  await dataSource.getRepository(PetForm).upsert(forms, ['code']);
  logger.log(`Формы питомца: ${forms.length}`);

  if (!env.SILO_ENDPOINT || !env.SILO_ACCESS_KEY || !env.SILO_SECRET_KEY) {
    logger.warn('SILO_ENDPOINT и ключи Silo не заданы: картинки форм не загружены');
    return;
  }
  const endpoint = new URL(env.SILO_ENDPOINT);
  const silo = new Client({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
    useSSL: endpoint.protocol === 'https:',
    accessKey: env.SILO_ACCESS_KEY,
    secretKey: env.SILO_SECRET_KEY,
  });
  for (const form of forms) {
    const image = renderPetFormImage(form.code);
    await silo.putObject(env.SILO_BUCKET, form.imageKey, image, image.length, { 'Content-Type': 'image/png' });
  }
  logger.log(`Картинки форм в Silo: ${forms.length} (бакет ${env.SILO_BUCKET})`);
});
