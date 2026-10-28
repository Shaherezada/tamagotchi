import { type DatabaseSchema, ProcessedEvent } from '@app/common';
import { CARE_MIGRATIONS } from '../migrations';
import { CareAction } from './care-actions/care-action.entity';
import { InventoryItem } from './inventory/inventory-item.entity';
import { Item } from './items/item.entity';
import { Purchase } from './shop/purchase.entity';
import { WalletTransaction } from './wallet/wallet-transaction.entity';
import { Wallet } from './wallet/wallet.entity';

export const CARE_SCHEMA: DatabaseSchema = {
  entities: [Item, Wallet, WalletTransaction, InventoryItem, Purchase, CareAction, ProcessedEvent],
  migrations: CARE_MIGRATIONS,
};
