import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareEnv } from '../care-env';
import { createSiloClient, IconStorage, SILO_CLIENT } from './icon-storage';
import { Item } from './item.entity';
import { ItemCatalogCache } from './item-catalog.cache';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [ItemsController],
  providers: [
    ItemsService,
    ItemCatalogCache,
    IconStorage,
    { provide: SILO_CLIENT, inject: [CareEnv], useFactory: createSiloClient },
  ],
  exports: [TypeOrmModule, ItemsService, IconStorage],
})
export class ItemsModule {}
