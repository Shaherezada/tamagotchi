import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { ItemsModule } from '../items/items.module';
import { WalletModule } from '../wallet/wallet.module';
import { Purchase } from './purchase.entity';
import { PurchasesController } from './purchases.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase]), ItemsModule, WalletModule, InventoryModule],
  controllers: [PurchasesController],
  providers: [ShopService],
})
export class ShopModule {}
