import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PetEventsHandler } from './pet-events.handler';
import { WelcomeHandler } from './welcome.handler';

@Module({
  imports: [NotificationsModule],
  providers: [WelcomeHandler, PetEventsHandler],
})
export class EventsModule {}
