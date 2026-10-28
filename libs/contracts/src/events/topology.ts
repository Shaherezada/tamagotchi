import { RoutingKey } from './routing-keys';

/** Топология RabbitMQ (§6). */
export const EVENTS_EXCHANGE = 'tamagotchi.events';
export const EVENTS_DLX = 'tamagotchi.events.dlx';
export const DELIVERY_LIMIT = 5;
export const PREFETCH = 10;

export interface QueueTopology {
  queue: string;
  deadLetterQueue: string;
  bindings: string[];
}

export const CARE_EVENTS_QUEUE: QueueTopology = {
  queue: 'care-service.events',
  deadLetterQueue: 'care-service.events.dlq',
  bindings: [RoutingKey.UserRegistered, RoutingKey.PetEvolved],
};

export const NOTIFICATIONS_EVENTS_QUEUE: QueueTopology = {
  queue: 'notifications-service.events',
  deadLetterQueue: 'notifications-service.events.dlq',
  bindings: [RoutingKey.UserRegistered, 'pet.*'],
};
