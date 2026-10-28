import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { ItemsModule } from '../items/items.module';
import { WalletModule } from '../wallet/wallet.module';
import { EvolutionRewardHandler } from './evolution-reward.handler';
import { StarterKitHandler } from './starter-kit.handler';

@Module({
  imports: [ItemsModule, WalletModule, InventoryModule],
  providers: [StarterKitHandler, EvolutionRewardHandler],
})
export class EventsModule {}
