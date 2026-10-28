import { BaseEnv } from '@app/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export const CARE_ENV_PREFIX = 'CARE';

export class CareEnv extends BaseEnv {
  /** Адрес gRPC PetCare в pets-service, host:port. */
  @Matches(/^[\w.-]+:\d{1,5}$/, { message: 'PETS_GRPC_URL: host:port, например pets-service:50051' })
  PETS_GRPC_URL: string;

  /** S3 API Silo для сервиса, например http://silo:9000. */
  @Matches(/^https?:\/\/\S+$/, { message: 'SILO_ENDPOINT должен начинаться с http:// или https://' })
  SILO_ENDPOINT: string;

  @IsString()
  @IsNotEmpty()
  SILO_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  SILO_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  SILO_BUCKET: string = 'tamagotchi-media';

  /** Адрес Silo для ссылок на иконки, видимый клиенту. */
  @Matches(/^https?:\/\/\S+$/, { message: 'SILO_PUBLIC_URL должен начинаться с http:// или https://' })
  SILO_PUBLIC_URL: string;
}
