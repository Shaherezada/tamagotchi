import { Module } from '@nestjs/common';
import { OutboxRelay } from './outbox.relay';
import { OutboxService } from './outbox.service';

/**
 * Outbox отправителя событий. Нужны RabbitMqModule.forRoot() и ScheduleModule.forRoot() в приложении,
 * а OutboxMessage – в списке сущностей и миграциях сервиса.
 */
@Module({
  providers: [OutboxService, OutboxRelay],
  exports: [OutboxService],
})
export class OutboxModule {}
