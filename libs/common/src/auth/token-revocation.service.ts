import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectRedis } from '../redis/redis.module';
import type { JwtUser } from './jwt-user';

export const REVOKED_KEY_PREFIX = 'auth:revoked:';

/** Отзыв токена при выходе (§11): ключ auth:revoked:<jti> живёт до истечения токена. */
@Injectable()
export class TokenRevocationService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async revoke(user: JwtUser): Promise<void> {
    const ttl = user.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(REVOKED_KEY_PREFIX + user.jti, '1', 'EX', ttl);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(REVOKED_KEY_PREFIX + jti)) === 1;
  }
}
