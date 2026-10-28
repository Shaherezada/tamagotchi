import type { EventEnvelope } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { OutboxMessage } from './outbox-message.entity';

/** Запись события в outbox той же транзакцией, что и изменение данных (manager – менеджер транзакции). */
@Injectable()
export class OutboxService {
  async add(manager: EntityManager, envelope: EventEnvelope): Promise<void> {
    await manager.insert(OutboxMessage, {
      id: envelope.eventId,
      routingKey: envelope.type,
      payload: envelope as EventEnvelope<object>,
    });
  }
}
