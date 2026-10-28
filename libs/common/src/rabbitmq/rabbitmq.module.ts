import type { QueueTopology } from '@app/contracts';
import { DynamicModule, Inject, Injectable, Module, OnApplicationShutdown, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AmqpConnectionManager, connect } from 'amqp-connection-manager';
import { BaseEnv } from '../config/base-env';
import { InboxService } from '../inbox/inbox.service';
import { RabbitConsumer } from './rabbit-consumer';
import { RabbitPublisher } from './rabbit-publisher';
import { AMQP_CONNECTION, CONSUMER_TOPOLOGY } from './rabbitmq.constants';

@Injectable()
class AmqpShutdown implements OnApplicationShutdown {
  constructor(@Inject(AMQP_CONNECTION) private readonly connection: AmqpConnectionManager) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}

export interface RabbitMqOptions {
  /** Очередь, которую слушает сервис; без неё модуль только публикует. */
  consume?: QueueTopology;
}

/**
 * RabbitMQ (§6): соединение с переподключением, издатель для outbox и, если задана очередь,
 * потребитель с inbox. Обработчики – провайдеры с @EventConsumer() в любом модуле приложения.
 */
@Module({})
export class RabbitMqModule {
  static forRoot(options: RabbitMqOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AMQP_CONNECTION,
        inject: [BaseEnv],
        useFactory: (env: BaseEnv) =>
          connect([env.RABBITMQ_URL], { heartbeatIntervalInSeconds: 15, reconnectTimeInSeconds: 5 }),
      },
      AmqpShutdown,
      RabbitPublisher,
    ];
    if (options.consume) {
      providers.push({ provide: CONSUMER_TOPOLOGY, useValue: options.consume }, InboxService, RabbitConsumer);
    }
    return {
      module: RabbitMqModule,
      global: true,
      imports: [DiscoveryModule],
      providers,
      exports: [RabbitPublisher, ...(options.consume ? [InboxService] : [])],
    };
  }
}
