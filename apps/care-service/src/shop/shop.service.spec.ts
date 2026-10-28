import { ProblemException } from '@app/common';
import { careFixture, PLAYER } from '../../test/care-fixtures';
import { Item } from '../items/item.entity';
import { Reason } from '../wallet/reason.enum';
import { Purchase } from './purchase.entity';
import { ShopService } from './shop.service';

describe('ShopService.buy', () => {
  function setup(balance: number) {
    const care = careFixture();
    care.giveCoins(PLAYER, balance);
    const shop = new ShopService(care.db.dataSource, care.wallet, care.inventory);
    return { ...care, shop };
  }

  it('монет хватает: списание, журнал, инвентарь и покупка – вместе', async () => {
    const { shop, items, db, ...care } = setup(100);

    const result = await shop.buy(PLAYER, { itemId: items.rice.id, quantity: 2 });

    expect(result).toEqual({
      purchaseId: expect.any(String),
      itemId: items.rice.id,
      quantity: 2,
      totalPrice: 10,
      balance: 90,
    });
    expect(care.balance(PLAYER)).toBe(90);
    expect(care.quantity(PLAYER, 'rice')).toBe(2);
    expect(care.journal(PLAYER)).toEqual([
      expect.objectContaining({
        amount: -10,
        balanceAfter: 90,
        reason: Reason.PURCHASE,
        referenceId: result.purchaseId,
      }),
    ]);
    expect(db.rows(Purchase)).toEqual([
      expect.objectContaining({ id: result.purchaseId, userId: PLAYER, quantity: 2, unitPrice: 5, totalPrice: 10 }),
    ]);
  });

  it('повторная покупка докладывает к уже имеющимся предметам', async () => {
    const { shop, items, ...care } = setup(100);
    care.giveItem(PLAYER, 'rice', 3);

    await shop.buy(PLAYER, { itemId: items.rice.id, quantity: 1 });

    expect(care.quantity(PLAYER, 'rice')).toBe(4);
  });

  it('монет не хватает: 409 insufficient-funds, ничего не изменилось', async () => {
    const { shop, items, db, ...care } = setup(12);

    const error = await shop.buy(PLAYER, { itemId: items.teddy.id, quantity: 1 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProblemException);
    expect((error as ProblemException).problem).toMatchObject({
      status: 409,
      type: 'https://tamagotchi.local/problems/insufficient-funds',
      detail: 'Нужно 60 монет, на счету 12',
    });
    expect(care.balance(PLAYER)).toBe(12);
    expect(care.quantity(PLAYER, 'teddy')).toBe(0);
    expect(care.journal(PLAYER)).toEqual([]);
    expect(db.rows(Purchase)).toEqual([]);
  });

  it('без кошелька (стартовый набор ещё не пришёл) – тоже 409', async () => {
    const care = careFixture();
    const shop = new ShopService(care.db.dataSource, care.wallet, care.inventory);

    await expect(shop.buy(PLAYER, { itemId: care.items.rice.id, quantity: 1 })).rejects.toMatchObject({
      problem: { status: 409 },
    });
  });

  it('предмет снят с продажи – 404', async () => {
    const { shop, items, db } = setup(100);
    db.rows(Item).find((i) => i.id === items.cake.id)!.isActive = false;

    await expect(shop.buy(PLAYER, { itemId: items.cake.id, quantity: 1 })).rejects.toMatchObject({
      problem: { status: 404 },
    });
  });
});
