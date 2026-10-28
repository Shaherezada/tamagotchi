import { ProblemException } from '@app/common';
import type { DataSource, EntityManager, EntitySubscriberInterface, QueryRunner, Repository } from 'typeorm';
import { NotificationStream } from '../stream/notification.stream';
import { NotificationsQuery } from './dto/notifications-query.dto';
import { NotificationSettings } from './notification-settings.entity';
import { NotificationType } from './notification-type.enum';
import { Notification } from './notification.entity';
import { decodeCursor, encodeCursor, NotificationsService } from './notifications.service';

const USER = '11111111-1111-4111-8111-111111111111';
const PET = '22222222-2222-4222-8222-222222222222';

interface Row {
  notification: Notification;
  /** created_at с микросекундами, как его отдаёт to_char в запросе. */
  at: string;
}

function row(i: number, at: string, isRead = false): Row {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const notification = Object.assign(new Notification(), {
    id,
    userId: USER,
    type: NotificationType.PET_HUNGRY,
    title: `#${i}`,
    body: 'Пушок голоден',
    petId: PET,
    isRead,
    createdAt: new Date(at),
    readAt: null,
  });
  return { notification, at };
}

/**
 * Query builder над массивом: понимает только вызовы из NotificationsService.list –
 * фильтр непрочитанных, условие курсора (created_at, id) < (:at, :id), сортировку по убыванию и limit.
 */
function fakeQueryBuilder(rows: Row[]) {
  let limit = Infinity;
  let unreadOnly = false;
  let cursor: { at: string; id: string } | null = null;
  const qb = {
    addSelect: () => qb,
    where: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    limit: (n: number) => {
      limit = n;
      return qb;
    },
    andWhere: jest.fn((sql: string, params?: { at: string; id: string }) => {
      if (sql.includes('is_read')) unreadOnly = true;
      if (params) cursor = params;
      return qb;
    }),
    getRawAndEntities: async () => {
      const before = (r: Row): boolean =>
        !cursor || r.at < cursor.at || (r.at === cursor.at && r.notification.id < cursor.id);
      const page = rows
        .filter((r) => !unreadOnly || !r.notification.isRead)
        .filter(before)
        .sort((a, b) => (a.at === b.at ? b.notification.id.localeCompare(a.notification.id) : b.at.localeCompare(a.at)))
        .slice(0, limit);
      return {
        entities: page.map((r) => r.notification),
        raw: page.map((r) => ({ n_id: r.notification.id, cursor_at: r.at })),
      };
    },
  };
  return qb;
}

function query(init: Partial<NotificationsQuery> = {}): NotificationsQuery {
  return Object.assign(new NotificationsQuery(), init);
}

/** Транзакция, как её видит notify: менеджер с queryRunner и рассылка подписчикам после коммита. */
function fakeTransaction(
  dataSource: { subscribers: EntitySubscriberInterface[] },
  settings: NotificationSettings | null,
) {
  const saved: Notification[] = [];
  const queryRunner = { data: {}, isTransactionActive: true } as unknown as QueryRunner;
  const manager = {
    queryRunner,
    findOneBy: jest.fn(async () => settings),
    create: (_entity: unknown, plain: Partial<Notification>) => Object.assign(new Notification(), plain),
    save: jest.fn(async (n: Notification) => {
      Object.assign(n, { id: `00000000-0000-4000-8000-${String(saved.length + 1).padStart(12, '0')}` });
      Object.assign(n, { isRead: false, createdAt: new Date('2026-11-05T10:15:00Z') });
      saved.push(n);
      return n;
    }),
  } as unknown as EntityManager;
  const commit = (): void => {
    dataSource.subscribers.forEach((s) => s.afterTransactionCommit?.({ queryRunner } as never));
  };
  const rollback = (): void => {
    dataSource.subscribers.forEach((s) => s.afterTransactionRollback?.({ queryRunner } as never));
  };
  return { manager, saved, commit, rollback };
}

function setup(rows: Row[] = []) {
  const dataSource = { subscribers: [] as EntitySubscriberInterface[] };
  const stream = new NotificationStream();
  const push = jest.spyOn(stream, 'push');
  const qb = fakeQueryBuilder(rows);
  const notifications = { createQueryBuilder: () => qb } as unknown as Repository<Notification>;
  const settings = {} as Repository<NotificationSettings>;
  const service = new NotificationsService(notifications, settings, stream, dataSource as unknown as DataSource);
  return { service, dataSource, push, qb };
}

function settingsRow(init: Partial<NotificationSettings>): NotificationSettings {
  return Object.assign(new NotificationSettings(), {
    userId: USER,
    petHungry: true,
    petSick: true,
    petEvolved: true,
    petDied: true,
    ...init,
  });
}

describe('NotificationsService.list – курсорная пагинация', () => {
  // три записи в одну микросекунду (одна транзакция) и две, отличающиеся только микросекундами
  const rows = [
    row(1, '2026-11-05T10:00:00.000001Z'),
    row(2, '2026-11-05T10:00:00.000002Z', true),
    row(3, '2026-11-05T10:05:00.000000Z'),
    row(4, '2026-11-05T10:05:00.000000Z'),
    row(5, '2026-11-05T10:05:00.000000Z', true),
    row(6, '2026-11-05T10:10:00.123456Z'),
    row(7, '2026-11-05T10:15:00.000000Z'),
  ];

  async function walk(service: NotificationsService, init: Partial<NotificationsQuery>): Promise<string[][]> {
    const pages: string[][] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list(USER, query({ ...init, cursor }));
      pages.push(page.items.map((n) => n.title));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return pages;
  }

  it('обходит все уведомления по страницам, новые первыми, без пропусков и повторов', async () => {
    const { service } = setup(rows);

    const pages = await walk(service, { limit: 2 });

    expect(pages).toEqual([['#7', '#6'], ['#5', '#4'], ['#3', '#2'], ['#1']]);
  });

  it('последняя полная страница не даёт курсора, если записей больше нет', async () => {
    const { service } = setup(rows.slice(0, 4));

    const first = await service.list(USER, query({ limit: 4 }));

    expect(first.items).toHaveLength(4);
    expect(first.nextCursor).toBeNull();
  });

  it('курсор несёт created_at с микросекундами и id последнего элемента страницы', async () => {
    const { service } = setup(rows);

    const page = await service.list(USER, query({ limit: 2 }));

    expect(decodeCursor(page.nextCursor!)).toEqual({ at: '2026-11-05T10:10:00.123456Z', id: rows[5].notification.id });
  });

  it('unreadOnly оставляет только непрочитанные', async () => {
    const { service } = setup(rows);

    const pages = await walk(service, { limit: 3, unreadOnly: true });

    expect(pages).toEqual([
      ['#7', '#6', '#4'],
      ['#3', '#1'],
    ]);
  });

  it('пустой список – пустая страница без курсора', async () => {
    const { service } = setup([]);

    await expect(service.list(USER, query())).resolves.toEqual({ items: [], nextCursor: null });
  });

  it.each(['мусор', encodeCursor({ at: 'вчера', id: PET }), encodeCursor({ at: '2026-11-05T10:00:00Z', id: '42' })])(
    'неверный курсор %s – 400 invalid-cursor',
    async (cursor) => {
      const { service } = setup(rows);

      const error = await service.list(USER, query({ cursor })).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProblemException);
      expect((error as ProblemException).problem).toMatchObject({
        status: 400,
        type: 'https://tamagotchi.local/problems/invalid-cursor',
      });
    },
  );
});

describe('NotificationsService.notify – настройки и поток', () => {
  const hungry = { userId: USER, type: NotificationType.PET_HUNGRY, title: 'Питомец голоден', body: '…', petId: PET };

  it.each([
    [NotificationType.PET_HUNGRY, 'petHungry'],
    [NotificationType.PET_SICK, 'petSick'],
    [NotificationType.PET_EVOLVED, 'petEvolved'],
    [NotificationType.PET_DIED, 'petDied'],
  ] as const)('выключенная настройка не даёт сохранить %s', async (type, setting) => {
    const { service, dataSource, push } = setup();
    const tx = fakeTransaction(dataSource, settingsRow({ [setting]: false }));

    await service.notify(tx.manager, { ...hungry, type });
    tx.commit();

    expect(tx.saved).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('выключенная настройка одного типа не мешает другим', async () => {
    const { service, dataSource } = setup();
    const tx = fakeTransaction(dataSource, settingsRow({ petHungry: false }));

    await service.notify(tx.manager, { ...hungry, type: NotificationType.PET_SICK });

    expect(tx.saved.map((n) => n.type)).toEqual([NotificationType.PET_SICK]);
  });

  it('приветствие приходит при любых настройках', async () => {
    const { service, dataSource } = setup();
    const tx = fakeTransaction(
      dataSource,
      settingsRow({ petHungry: false, petSick: false, petEvolved: false, petDied: false }),
    );

    await service.notify(tx.manager, { userId: USER, type: NotificationType.WELCOME, title: 'Привет', body: '…' });

    expect(tx.saved.map((n) => n.type)).toEqual([NotificationType.WELCOME]);
  });

  it('без строки настроек присылается всё', async () => {
    const { service, dataSource } = setup();
    const tx = fakeTransaction(dataSource, null);

    await service.notify(tx.manager, hungry);

    expect(tx.saved).toHaveLength(1);
    expect(tx.saved[0]).toMatchObject({ userId: USER, petId: PET, type: NotificationType.PET_HUNGRY });
  });

  it('в поток уведомление уходит только после коммита', async () => {
    const { service, dataSource, push } = setup();
    const tx = fakeTransaction(dataSource, null);

    await service.notify(tx.manager, hungry);
    expect(push).not.toHaveBeenCalled();

    tx.commit();
    expect(push).toHaveBeenCalledWith(USER, expect.objectContaining({ title: 'Питомец голоден', petId: PET }));
  });

  it('после отката транзакции в поток ничего не уходит', async () => {
    const { service, dataSource, push } = setup();
    const tx = fakeTransaction(dataSource, null);

    await service.notify(tx.manager, hungry);
    tx.rollback();
    tx.commit();

    expect(push).not.toHaveBeenCalled();
  });
});
