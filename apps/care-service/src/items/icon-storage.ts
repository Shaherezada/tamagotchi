import { Inject, Injectable } from '@nestjs/common';
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

  async put(key: string, content: Buffer, type: string): Promise<void> {
    await this.client.putObject(this.bucket, key, content, content.length, { 'Content-Type': type });
  }

  /** Публичная ссылка: бакет открыт на чтение (deploy/silo/init-bucket.sh). */
  url(key: string): string {
    return `${this.env.SILO_PUBLIC_URL.replace(/\/+$/, '')}/${this.bucket}/${key}`;
  }
}
