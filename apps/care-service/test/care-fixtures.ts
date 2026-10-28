import { InventoryItem } from '../src/inventory/inventory-item.entity';
import { InventoryService } from '../src/inventory/inventory.service';
import type { IconStorage } from '../src/items/icon-storage';
import { Item } from '../src/items/item.entity';
import { ITEMS } from '../src/items/items.catalog';
import { WalletTransaction } from '../src/wallet/wallet-transaction.entity';
import { Wallet } from '../src/wallet/wallet.entity';
import { WalletService } from '../src/wallet/wallet.service';
import { InMemoryDb } from './in-memory-db';

export const PLAYER = '0b7e6c1a-3a52-4d55-9a6f-1c2d3e4f5a6b';

/** care_db в памяти с каталогом из сида и настоящими WalletService и InventoryService. */
export function careFixture() {
  const db = new InMemoryDb(
    new Map<abstract new (...args: never[]) => object, string[]>([
      [Wallet, ['userId']],
      [InventoryItem, ['userId', 'itemId']],
    ]),
  );
  const icons = { url: (key: string) => `http://silo.test/tamagotchi-media/${key}` } as IconStorage;
  const wallet = new WalletService(db.repository(Wallet), db.repository(WalletTransaction));
  const inventory = new InventoryService(db.repository(InventoryItem), icons);
  const items = Object.fromEntries(
    ITEMS.map((seed) => [seed.code, db.insert(Item, { ...seed, isActive: true, iconKey: null })]),
  ) as Record<string, Item>;

  return {
    db,
    icons,
    wallet,
    inventory,
    items,
    giveCoins(userId: string, balance: number) {
      db.insert(Wallet, { userId, balance });
    },
    giveItem(userId: string, code: string, quantity: number) {
      db.insert(InventoryItem, { userId, itemId: items[code].id, quantity });
    },
    balance(userId: string): number {
      return db.rows(Wallet).find((w) => w.userId === userId)?.balance ?? 0;
    },
    quantity(userId: string, code: string): number {
      return db.rows(InventoryItem).find((r) => r.userId === userId && r.itemId === items[code].id)?.quantity ?? 0;
    },
    journal(userId: string): WalletTransaction[] {
      return db.rows(WalletTransaction).filter((t) => t.wallet.userId === userId);
    },
  };
}
