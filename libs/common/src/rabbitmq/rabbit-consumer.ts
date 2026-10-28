import { DELIVERY_LIMIT, type EventEnvelope, PREFETCH, type QueueTopology } from '@app/contracts';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { InboxService } from '../inbox/inbox.service';
import { EVENT_HANDLER_METADATA, EventHandler, matchesRoutingKey } from './event-handler';
import { AMQP_CONNECTION, CONSUMER_TOPOLOGY } from './rabbitmq.constants';
import { assertConsumerQueues, assertExchanges } from './topology';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETRY_DELAY_MS = 1000;

/**
 * Номер доставки сообщения, с единицы. RabbitMQ 4 не считает nack с возвратом неудачной доставкой
 * (x-delivery-limit на него не срабатывает), но пишет в x-acquired-count, сколько раз сообщение уже выдавалось.
 */
export function deliveryAttempt(message: ConsumeMessage): number {
  const headers = message.properties.headers ?? {};
  const previous = Math.max(Number(headers['x-acquired-count'] ?? 0), Number(headers['x-delivery-count'] ?? 0));
  return (Number.isFinite(previous) ? previous : 0) + 1;
}

/**
 * Потребитель очереди сервиса: ручной ack после коммита inbox, prefetch = 10. Ошибка обработчика –
 * nack с возвратом через паузу; пятая неудачная доставка – nack без возврата, и брокер перекладывает
 * сообщение через tamagotchi.events.dlx в <сервис>.events.dlq. x-delivery-limit у очереди ловит
 * доставки, оборванные падением потребителя.
 */
@Injectable()
export class RabbitConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumer.name);
  private channel: ChannelWrapper;
  private handlers: EventHandler[] = [];

  constructor(
    @Inject(AMQP_CONNECTION) private readonly connection: AmqpConnectionManager,
    @Inject(CONSUMER_TOPOLOGY) private readonly topology: QueueTopology,
    private readonly inbox: InboxService,
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    this.handlers = this.discovery
      .getProviders()
      .filter((wrapper) => wrapper.metatype && this.reflector.get(EVENT_HANDLER_METADATA, wrapper.metatype))
      .map((wrapper) => wrapper.instance as EventHandler);
    this.channel = this.connection.createChannel({
      name: this.topology.queue,
      setup: async (channel: Channel) => {
        await assertExchanges(channel);
        await assertConsumerQueues(channel, this.topology);
      },
    });
    this.channel
      .consume(this.topology.queue, (message) => this.dispatch(message), { noAck: false, prefetch: PREFETCH })
      .catch((error: unknown) => this.logger.error(`Не удалось подписаться на ${this.topology.queue}`, String(error)));
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  private async dispatch(message: ConsumeMessage): Promise<void> {
    const routingKey = message.fields.routingKey;
    const envelope = this.parse(message);
    if (!envelope) {
      this.logger.error(`Сообщение ${routingKey} не похоже на конверт события – в DLQ`);
      this.channel.nack(message, false, false);
      return;
    }
    const handler = this.handlers.find((h) => h.routingKeys.some((key) => matchesRoutingKey(key, routingKey)));
    if (!handler) {
      this.logger.warn(`Нет обработчика для ${routingKey}, событие ${envelope.eventId} пропущено`);
      this.channel.ack(message);
      return;
    }
    try {
      await this.inbox.process(envelope, handler);
      this.channel.ack(message);
    } catch (error) {
      const attempt = deliveryAttempt(message);
      const last = attempt >= DELIVERY_LIMIT;
      this.logger.error(
        `Ошибка обработки ${routingKey} ${envelope.eventId}, доставка ${attempt} из ${DELIVERY_LIMIT}` +
          (last ? ' – в DLQ' : ', повтор'),
        error instanceof Error ? error.stack : String(error),
      );
      if (!last) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
      this.channel.nack(message, false, !last);
    }
  }

  private parse(message: ConsumeMessage): EventEnvelope | null {
    try {
      const envelope = JSON.parse(message.content.toString('utf8')) as Partial<EventEnvelope>;
      const valid =
        typeof envelope.eventId === 'string' && UUID.test(envelope.eventId) && typeof envelope.type === 'string';
      return valid ? (envelope as EventEnvelope) : null;
    } catch {
      return null;
    }
  }
}
