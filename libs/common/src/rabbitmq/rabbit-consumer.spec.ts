import type { ConsumeMessage } from 'amqplib';
import { deliveryAttempt } from './rabbit-consumer';

function message(headers?: Record<string, unknown>): ConsumeMessage {
  return { properties: { headers } } as unknown as ConsumeMessage;
}

describe('deliveryAttempt', () => {
  it('первая доставка – 1', () => {
    expect(deliveryAttempt(message())).toBe(1);
    expect(deliveryAttempt(message({}))).toBe(1);
  });

  it('считает по x-acquired-count (RabbitMQ 4) и x-delivery-count (RabbitMQ 3)', () => {
    expect(deliveryAttempt(message({ 'x-acquired-count': 4 }))).toBe(5);
    expect(deliveryAttempt(message({ 'x-delivery-count': 2 }))).toBe(3);
    expect(deliveryAttempt(message({ 'x-acquired-count': 1, 'x-delivery-count': 3 }))).toBe(4);
  });
});
