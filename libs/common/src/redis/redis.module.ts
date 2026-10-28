import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { BaseEnv } from '../config/base-env';

export const REDIS = Symbol('REDIS');

/** Внедрение общего клиента Redis: `constructor(@InjectRedis() private readonly redis: Redis)`. */
export const InjectRedis = (): ParameterDecorator => Inject(REDIS);

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** Один клиент ioredis на сервис (REDIS_URL): отзыв токенов и кэш каталога. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [BaseEnv],
      useFactory: (env: BaseEnv) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }),
    },
    RedisShutdown,
  ],
  exports: [REDIS],
})
export class RedisModule {}
