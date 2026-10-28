import { EVENTS_EXCHANGE } from '@app/contracts';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { OutboxMessage } from '../outbox/outbox-message.entity';
import { AMQP_CONNECTION, PUBLISH_CONFIRM_TIMEOUT_MS } from './rabbitmq.constants';
import { assertExchanges } from './topology';

/** Публикация события в tamagotchi.events с подтверждением брокера (publisher confirms). */
@Injectable()
export class RabbitPublisher implements OnModuleDestroy {
  private readonly channel: ChannelWrapper;

  constructor(@Inject(AMQP_CONNECTION) connection: AmqpConnectionManager) {
    this.channel = connection.createChannel({
      name: 'publisher',
      confirm: true,
      setup: (channel: ConfirmChannel) => assertExchanges(channel),
    });
  }

  /** Промис выполняется только после подтверждения брокера; при отказе или таймауте – ошибка. */
  async publish(message: OutboxMessage): Promise<void> {
    await this.channel.publish(EVENTS_EXCHANGE, message.routingKey, Buffer.from(JSON.stringify(message.payload)), {
      messageId: message.id,
      type: message.routingKey,
      contentType: 'application/json',
      persistent: true,
      timestamp: Math.floor(Date.now() / 1000),
      timeout: PUBLISH_CONFIRM_TIMEOUT_MS,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
  }
}
