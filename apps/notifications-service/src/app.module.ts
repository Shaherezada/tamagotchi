import { ConfigModule, DatabaseModule, JwtAuthModule, RabbitMqModule } from '@app/common';
import { NOTIFICATIONS_EVENTS_QUEUE } from '@app/contracts';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NOTIFICATIONS_SCHEMA } from './database';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NOTIFICATIONS_ENV_PREFIX, NotificationsEnv } from './notifications-env';
import { StreamModule } from './stream/stream.module';

@Module({
  imports: [
    ConfigModule.forRoot(NotificationsEnv, NOTIFICATIONS_ENV_PREFIX),
    DatabaseModule.forRoot(NOTIFICATIONS_SCHEMA),
    ScheduleModule.forRoot(),
    RabbitMqModule.forRoot({ consume: NOTIFICATIONS_EVENTS_QUEUE }),
    JwtAuthModule,
    StreamModule,
    NotificationsModule,
    EventsModule,
  ],
})
export class AppModule {}
