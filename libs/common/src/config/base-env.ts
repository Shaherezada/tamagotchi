import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';
import { ToBoolean } from './env-transformers';

/** Переменные окружения, общие для всех сервисов (§13). Значения по умолчанию – для локального запуска. */
export class BaseEnv {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  /** Накатывать миграции при старте сервиса. */
  @ToBoolean()
  @IsBoolean()
  DB_MIGRATIONS_RUN: boolean = true;

  @Matches(/^amqps?:\/\/\S+$/, { message: 'RABBITMQ_URL должен начинаться с amqp:// или amqps://' })
  RABBITMQ_URL: string;

  @Matches(/^rediss?:\/\/\S+$/, { message: 'REDIS_URL должен начинаться с redis:// или rediss://' })
  REDIS_URL: string;

  /** Открытый ключ RS256 для проверки JWT. */
  @IsString()
  @IsNotEmpty()
  JWT_PUBLIC_KEY_FILE: string;
}
