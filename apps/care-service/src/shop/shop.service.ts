import { Injectable, NotImplementedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { WalletService } from '../wallet/wallet.service';
import { PurchaseResultDto } from './dto/purchase-result.dto';
import { PurchaseDto } from './dto/purchase.dto';

@Injectable()
export class ShopService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly inventory: InventoryService,
  ) {}

  /** Кошелёк FOR UPDATE, списание, журнал, инвентарь, запись покупки – одной транзакцией (§7). */
  buy(_userId: string, _dto: PurchaseDto): Promise<PurchaseResultDto> {
    throw new NotImplementedException();
  }
}
