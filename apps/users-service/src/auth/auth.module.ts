import { readFileSync } from 'node:fs';
import { OutboxModule } from '@app/common';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { UsersEnv } from '../users-env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtTokenService, TOKEN_TTL_SECONDS } from './jwt-token.service';

@Module({
  imports: [
    UsersModule,
    OutboxModule,
    JwtModule.registerAsync({
      inject: [UsersEnv],
      useFactory: (env: UsersEnv) => ({
        privateKey: readFileSync(env.JWT_PRIVATE_KEY_FILE, 'utf8'),
        publicKey: readFileSync(env.JWT_PUBLIC_KEY_FILE, 'utf8'),
        signOptions: { algorithm: 'RS256', expiresIn: TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtTokenService],
})
export class AuthModule {}
