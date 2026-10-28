import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseEnv } from '../config/base-env';
import { dataSourceOptions, DatabaseSchema } from './data-source-options';

@Module({})
export class DatabaseModule {
  static forRoot(schema: DatabaseSchema): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [BaseEnv],
          useFactory: (env: BaseEnv) => dataSourceOptions(env, schema),
        }),
      ],
    };
  }
}
