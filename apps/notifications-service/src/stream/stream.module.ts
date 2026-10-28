import { Module } from '@nestjs/common';
import { NotificationStream } from './notification.stream';

@Module({
  providers: [NotificationStream],
  exports: [NotificationStream],
})
export class StreamModule {}
