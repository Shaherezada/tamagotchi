import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { Client } from 'minio';
import { CareEnv } from '../care-env';

export const SILO_CLIENT = Symbol('SILO_CLIENT');

export function createSiloClient(env: CareEnv): Client {
  const endpoint = new URL(env.SILO_ENDPOINT);
  return new Client({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
    useSSL: endpoint.protocol === 'https:',
    accessKey: env.SILO_ACCESS_KEY,
    secretKey: env.SILO_SECRET_KEY,
  });
}

/** Иконки предметов в Silo (§12): ключ items/<itemId>.<ext>, клиенту – публичная ссылка. */
@Injectable()
export class IconStorage {
  private readonly bucket: string;

  constructor(
    @Inject(SILO_CLIENT) private readonly client: Client,
    private readonly env: CareEnv,
  ) {
    this.bucket = env.SILO_BUCKET;
  }

  put(_key: string, _content: Buffer, _type: string): Promise<void> {
    throw new NotImplementedException();
  }

  url(_key: string): string {
    throw new NotImplementedException();
  }
}
