import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BaseEnv } from '../config/base-env';
import { RedisModule } from '../redis/redis.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TokenRevocationService } from './token-revocation.service';

/**
 * Проверка доступа во всех сервисах: JwtAuthGuard и RolesGuard глобальны (по умолчанию метод закрыт),
 * открытые методы помечаются @Public(). Подписывает токены только users-service своим JwtModule.
 */
@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      inject: [BaseEnv],
      useFactory: (env: BaseEnv) => ({
        publicKey: readFileSync(env.JWT_PUBLIC_KEY_FILE, 'utf8'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  providers: [
    TokenRevocationService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenRevocationService],
})
export class AuthModule {}
