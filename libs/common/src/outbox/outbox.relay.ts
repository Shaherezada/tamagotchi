import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { RabbitPublisher } from '../rabbitmq/rabbit-publisher';
import { OutboxMessage } from './outbox-message.entity';

const BATCH_SIZE = 100;

/**
 * Ретранслятор outbox (§6): раз в секунду берёт неотправленные записи с FOR UPDATE SKIP LOCKED
 * (несколько экземпляров сервиса не отправят одну запись дважды), публикует с подтверждением
 * и ставит published_at. При ошибке – attempts + 1 и last_error, остаток пачки ждёт следующего раза.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: RabbitPublisher,
  ) {}

  @Interval('outbox-relay', 1000)
  async relay(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const batch = await manager
          .getRepository(OutboxMessage)
          .createQueryBuilder('message')
          .where('message.publishedAt IS NULL')
          .orderBy('message.createdAt', 'ASC')
          .limit(BATCH_SIZE)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();
        for (const message of batch) {
          try {
            await this.publisher.publish(message);
            await manager.update(OutboxMessage, message.id, {
              publishedAt: new Date(),
              attempts: message.attempts + 1,
              lastError: null,
            });
          } catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            await manager.update(OutboxMessage, message.id, {
              attempts: message.attempts + 1,
              lastError: text.slice(0, 512),
            });
            this.logger.warn(`Событие ${message.id} (${message.routingKey}) не опубликовано: ${text}`);
            break;
          }
        }
      });
    } catch (error) {
      this.logger.error('Ошибка ретранслятора outbox', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
