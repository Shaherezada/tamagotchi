import { BaseEnv, ToBoolean } from '@app/common';
import { PETS_GRPC_PORT } from '@app/contracts';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsString, Matches, Max, Min } from 'class-validator';

export const PETS_ENV_PREFIX = 'PETS';

export class PetsEnv extends BaseEnv {
  /** Скорость игрового времени: 1 – реальное время (§8). */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  GAME_SPEED: number = 1;

  /** Период планировщика жизненного цикла, мс. */
  @Type(() => Number)
  @IsInt()
  @Min(100)
  TICK_MS: number = 5000;

  /** Разрешает перемотку времени питомца (POST /api/admin/pets/{petId}/time-travel). */
  @ToBoolean()
  @IsBoolean()
  DEMO_MODE: boolean = false;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  GRPC_PORT: number = PETS_GRPC_PORT;

  /** Адрес Silo для ссылок на картинки форм, видимый клиенту. */
  @Matches(/^https?:\/\/\S+$/, { message: 'SILO_PUBLIC_URL должен начинаться с http:// или https://' })
  SILO_PUBLIC_URL: string;

  @IsString()
  @IsNotEmpty()
  SILO_BUCKET: string = 'tamagotchi-media';
}
