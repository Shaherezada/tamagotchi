import { careFixture, PLAYER } from '../../test/care-fixtures';
import { CareAction } from './care-action.entity';
import { RETRY_AFTER_MS, CareActionRetrier } from './care-action.retrier';
import type { CareActionsService } from './care-actions.service';
import { CareStatus, CareType } from './care-enums';

describe('CareActionRetrier.retryPending', () => {
  it(`повторяет только PENDING старше ${RETRY_AFTER_MS / 1000} с, старые первыми`, async () => {
    const { db } = careFixture();
    const ago = (ms: number) => new Date(Date.now() - ms);
    const add = (status: CareStatus, createdAt: Date) =>
      db.insert(CareAction, {
        userId: PLAYER,
        petId: PLAYER,
        type: CareType.CLEAN,
        item: null,
        status,
        attempts: 1,
        createdAt,
      });
    const stale = add(CareStatus.PENDING, ago(60_000));
    const older = add(CareStatus.PENDING, ago(120_000));
    add(CareStatus.PENDING, ago(5_000));
    add(CareStatus.APPLIED, ago(120_000));
    add(CareStatus.REJECTED, ago(120_000));
    const careActions = { retry: jest.fn().mockResolvedValue(undefined) };
    const retrier = new CareActionRetrier(careActions as unknown as CareActionsService, db.repository(CareAction));

    await retrier.retryPending();

    expect(careActions.retry.mock.calls.map(([a]: [CareAction]) => a.id)).toEqual([older.id, stale.id]);
  });

  it('ошибка одного действия не останавливает остальные', async () => {
    const { db } = careFixture();
    const old = new Date(Date.now() - 60_000);
    for (let i = 0; i < 2; i++) {
      db.insert(CareAction, {
        userId: PLAYER,
        petId: PLAYER,
        type: CareType.CLEAN,
        item: null,
        status: CareStatus.PENDING,
        createdAt: old,
      });
    }
    const careActions = { retry: jest.fn().mockRejectedValueOnce(new Error('сбой')).mockResolvedValue(undefined) };
    const retrier = new CareActionRetrier(careActions as unknown as CareActionsService, db.repository(CareAction));

    await expect(retrier.retryPending()).resolves.toBeUndefined();
    expect(careActions.retry).toHaveBeenCalledTimes(2);
  });
});
