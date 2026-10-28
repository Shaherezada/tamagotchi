import type { EventEnvelope } from '@app/contracts';
import { SetMetadata } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export const EVENT_HANDLER_METADATA = 'tamagotchi:event-handler';

/**
 * Обработчик события из брокера. handle() вызывается внутри транзакции inbox: все изменения –
 * через переданный manager, тогда отметка события и действие фиксируются вместе.
 */
export interface EventHandler {
  readonly routingKeys: string[];
  handle(envelope: EventEnvelope, manager: EntityManager): Promise<void>;
}

/** Помечает провайдер как обработчик событий: RabbitConsumer находит такие классы сам. */
export const EventConsumer = (): ClassDecorator => SetMetadata(EVENT_HANDLER_METADATA, true);

/** Сравнение ключа маршрутизации с шаблоном topic-exchange: * – одно слово, # – сколько угодно. */
export function matchesRoutingKey(pattern: string, routingKey: string): boolean {
  const words = pattern.split('.');
  const keys = routingKey.split('.');
  const match = (i: number, j: number): boolean => {
    if (i === words.length) return j === keys.length;
    if (words[i] === '#') return match(i + 1, j) || (j < keys.length && match(i, j + 1));
    if (j === keys.length) return false;
    return (words[i] === '*' || words[i] === keys[j]) && match(i + 1, j + 1);
  };
  return match(0, 0);
}
