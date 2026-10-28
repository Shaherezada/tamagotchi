import { ConfigModule, DatabaseModule, JwtAuthModule, RabbitMqModule } from '@app/common';
import { CARE_EVENTS_QUEUE } from '@app/contracts';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CARE_ENV_PREFIX, CareEnv } from './care-env';
import { CareActionsModule } from './care-actions/care-actions.module';
import { CARE_SCHEMA } from './database';
import { EventsModule } from './events/events.module';
import { InventoryModule } from './inventory/inventory.module';
import { ItemsModule } from './items/items.module';
import { ShopModule } from './shop/shop.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot(CareEnv, CARE_ENV_PREFIX),
    DatabaseModule.forRoot(CARE_SCHEMA),
    ScheduleModule.forRoot(),
    RabbitMqModule.forRoot({ consume: CARE_EVENTS_QUEUE }),
    JwtAuthModule,
    ItemsModule,
    WalletModule,
    InventoryModule,
    ShopModule,
    CareActionsModule,
    EventsModule,
  ],
})
export class AppModule {}
