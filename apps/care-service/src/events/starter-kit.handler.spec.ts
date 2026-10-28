import { InboxService } from '@app/common';
import { createEnvelope, RoutingKey, type PetEvolved, type UserRegistered } from '@app/contracts';
import { careFixture, PLAYER } from '../../test/care-fixtures';
import { Reason } from '../wallet/reason.enum';
import { EvolutionRewardHandler } from './evolution-reward.handler';
import { STARTER_COINS } from './rewards';
import { StarterKitHandler } from './starter-kit.handler';

const registered = (userId = PLAYER) =>
  createEnvelope<UserRegistered>(RoutingKey.UserRegistered, {
    userId,
    login: 'masha',
    nickname: 'Маша',
    registeredAt: new Date().toISOString(),
  });

describe('StarterKitHandler', () => {
  function setup() {
    const care = careFixture();
    const inbox = new InboxService(care.db.dataSource);
    const handler = new StarterKitHandler(care.wallet, care.inventory);
    return { ...care, inbox, handler };
  }

  it('кошелёк со 100 монетами и предметы набора', async () => {
    const { inbox, handler, ...care } = setup();

    await inbox.process(registered(), handler);

    expect(care.balance(PLAYER)).toBe(STARTER_COINS);
    expect(care.journal(PLAYER)).toEqual([
      expect.objectContaining({ amount: 100, balanceAfter: 100, reason: Reason.STARTER_KIT }),
    ]);
    expect(['rice', 'candy', 'pill', 'ball'].map((code) => care.quantity(PLAYER, code))).toEqual([3, 2, 1, 1]);
  });

  it('повторная доставка того же события не выдаёт набор второй раз', async () => {
    const { inbox, handler, ...care } = setup();
    const envelope = registered();

    await inbox.process(envelope, handler);
    await inbox.process({ ...envelope }, handler);

    expect(care.balance(PLAYER)).toBe(STARTER_COINS);
    expect(care.quantity(PLAYER, 'rice')).toBe(3);
  });

  it('второе событие о том же игроке (другой eventId) – тоже без второго набора', async () => {
    const { inbox, handler, ...care } = setup();

    await inbox.process(registered(), handler);
    await inbox.process(registered(), handler);

    expect(care.balance(PLAYER)).toBe(STARTER_COINS);
    expect(care.journal(PLAYER)).toHaveLength(1);
    expect(care.quantity(PLAYER, 'candy')).toBe(2);
  });

  it('нет предметов набора в каталоге – ошибка и откат, событие повторится', async () => {
    const { inbox, handler, db, items, ...care } = setup();
    items.pill.code = 'pill_old';

    await expect(inbox.process(registered(), handler)).rejects.toThrow('pill');
    expect(care.balance(PLAYER)).toBe(0);
    void db;
  });
});

describe('EvolutionRewardHandler', () => {
  const evolved = (toStage: string) =>
    createEnvelope<PetEvolved>(RoutingKey.PetEvolved, {
      petId: '5f2b8c1d-7e3a-4b6c-9d0e-1a2b3c4d5e6f',
      ownerId: PLAYER,
      petName: 'Пушок',
      fromStage: 'TEEN',
      toStage,
      formCode: 'adult_good',
      careMistakes: 1,
    });

  it('ADULT – 50 монет, ELDER – 100, другие стадии – ничего; повтор события не платит дважды', async () => {
    const care = careFixture();
    care.giveCoins(PLAYER, 0);
    const inbox = new InboxService(care.db.dataSource);
    const handler = new EvolutionRewardHandler(care.wallet);
    const adult = evolved('ADULT');

    await inbox.process(evolved('TEEN'), handler);
    await inbox.process(adult, handler);
    await inbox.process(adult, handler);
    await inbox.process(evolved('ELDER'), handler);

    expect(care.balance(PLAYER)).toBe(150);
    expect(care.journal(PLAYER).map((t) => [t.amount, t.reason])).toEqual([
      [50, Reason.EVOLUTION_REWARD],
      [100, Reason.EVOLUTION_REWARD],
    ]);
  });
});
