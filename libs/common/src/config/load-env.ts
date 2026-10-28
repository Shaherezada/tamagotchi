import { existsSync } from 'node:fs';
import type { Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

// у каждого сервиса свои база и порт, а локально все читают один .env: там они записаны с префиксом
const PREFIXED_KEYS = ['PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

let envFileLoaded = false;

/** Подхватывает .env из текущего каталога; уже заданные переменные окружения не перезаписываются. */
export function loadEnvFile(): void {
  if (!envFileLoaded && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  envFileLoaded = true;
}

/**
 * Читает и проверяет окружение сервиса. Если DB_NAME, DB_USER, DB_PASSWORD или PORT не заданы,
 * берутся <PREFIX>_DB_NAME и т. д. (USERS_DB_NAME для users-service). Ошибки – одним сообщением при старте.
 */
export function loadEnv<T extends object>(envClass: Type<T>, prefix: string): T {
  loadEnvFile();
  const raw: Record<string, string | undefined> = { ...process.env };
  for (const key of PREFIXED_KEYS) {
    if (raw[key] === undefined && raw[`${prefix}_${key}`] !== undefined) {
      raw[key] = raw[`${prefix}_${key}`];
    }
  }
  const env = plainToInstance(envClass, raw);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map((e) => ` - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`);
    throw new Error(`Неверная конфигурация окружения:\n${lines.join('\n')}`);
  }
  return env;
}
