import { randomUUID } from 'node:crypto';

/** Конверт события в RabbitMQ (§6): свойство AMQP messageId = eventId. */
export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  payload: T;
}

export function createEnvelope<T>(type: string, payload: T, occurredAt: Date = new Date()): EventEnvelope<T> {
  return { eventId: randomUUID(), type, version: 1, occurredAt: occurredAt.toISOString(), payload };
}
