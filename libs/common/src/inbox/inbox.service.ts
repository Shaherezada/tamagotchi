import type { EventEnvelope } from '@app/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EventHandler } from '../rabbitmq/event-handler';

/**
 * Идемпотентный потребитель (§6): отметка события в processed_events и действие обработчика –
 * одна транзакция; повторная доставка того же eventId ничего не меняет.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly dataSource: DataSource) {}

  async process(envelope: EventEnvelope, handler: EventHandler): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const inserted: unknown[] = await manager.query(
        'INSERT INTO processed_events (event_id, routing_key) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id',
        [envelope.eventId, envelope.type],
      );
      if (inserted.length === 0) {
        this.logger.log(`Событие ${envelope.eventId} (${envelope.type}) уже обработано – пропуск`);
        return;
      }
      await handler.handle(envelope, manager);
    });
  }
}
