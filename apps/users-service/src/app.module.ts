import { ConfigModule, DatabaseModule, JwtAuthModule, RabbitMqModule } from '@app/common';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { USERS_SCHEMA } from './database';
import { UsersModule } from './users/users.module';
import { USERS_ENV_PREFIX, UsersEnv } from './users-env';

@Module({
  imports: [
    ConfigModule.forRoot(UsersEnv, USERS_ENV_PREFIX),
    DatabaseModule.forRoot(USERS_SCHEMA),
    ScheduleModule.forRoot(),
    RabbitMqModule.forRoot(),
    JwtAuthModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
