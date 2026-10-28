import { DynamicModule, Global, Module, Type } from '@nestjs/common';
import { BaseEnv } from './base-env';
import { loadEnv } from './load-env';

/**
 * Окружение сервиса как провайдер: внедряется по своему классу (UsersEnv) и по BaseEnv.
 * Читается фабрикой, поэтому экспорт OpenAPI в режиме preview работает без переменных окружения.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot<T extends BaseEnv>(envClass: Type<T>, prefix: string): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: envClass, useFactory: () => loadEnv(envClass, prefix) },
        { provide: BaseEnv, useExisting: envClass },
      ],
      exports: [envClass, BaseEnv],
    };
  }
}
