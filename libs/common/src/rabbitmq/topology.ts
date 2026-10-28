import { DELIVERY_LIMIT, EVENTS_DLX, EVENTS_EXCHANGE, QueueTopology } from '@app/contracts';
import type { Channel } from 'amqplib';

/** Exchange событий (topic) и exchange недоставленных (direct); объявление идемпотентно. */
export async function assertExchanges(channel: Channel): Promise<void> {
  await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(EVENTS_DLX, 'direct', { durable: true });
}

/**
 * Очередь потребителя – quorum с x-delivery-limit: после пяти неудачных доставок сообщение уходит
 * в DLX с ключом = имя очереди, а оттуда в <сервис>.events.dlq. Отдельный ключ нужен, чтобы
 * недоставленные одного сервиса не попадали в DLQ другого.
 */
export async function assertConsumerQueues(channel: Channel, topology: QueueTopology): Promise<void> {
  await channel.assertQueue(topology.deadLetterQueue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
  await channel.bindQueue(topology.deadLetterQueue, EVENTS_DLX, topology.queue);
  await channel.assertQueue(topology.queue, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-delivery-limit': DELIVERY_LIMIT,
      'x-dead-letter-exchange': EVENTS_DLX,
      'x-dead-letter-routing-key': topology.queue,
    },
  });
  for (const key of topology.bindings) {
    await channel.bindQueue(topology.queue, EVENTS_EXCHANGE, key);
  }
}
