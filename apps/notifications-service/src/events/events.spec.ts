import { InboxService } from '@app/common';
import { createEnvelope, type EventEnvelope, RoutingKey } from '@app/contracts';
import type { DataSource, EntityManager, EntitySubscriberInterface, QueryRunner, Repository } from 'typeorm';
import { NotificationType } from '../notifications/notification-type.enum';
import { Notification } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStream } from '../stream/notification.stream';
import { NotificationTexts } from './notification-texts';
import { PetEventsHandler } from './pet-events.handler';
import { WelcomeHandler } from './welcome.handler';

const USER = '11111111-1111-4111-8111-111111111111';
const PET = '22222222-2222-4222-8222-222222222222';
const pet = { petId: PET, ownerId: USER, petName: 'Пушок' };

/**
 * База в памяти для пути «брокер → inbox → обработчик → notify»: processed_events с ON CONFLICT DO NOTHING,
 * таблица notifications, коммит или откат транзакции с рассылкой подписчикам TypeORM.
 */
function fakeDatabase() {
  const processed = new Set<string>();
  const notifications: Notification[] = [];
  const dataSource = {
    subscribers: [] as EntitySubscriberInterface[],
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const queryRunner = { data: {}, isTransactionActive: true } as unknown as QueryRunner;
      const pendingEvents: string[] = [];
      const pendingRows: Notification[] = [];
      const manager = {
        queryRunner,
        query: async (_sql: string, [eventId]: [string]) => {
          if (processed.has(eventId) || pendingEvents.includes(eventId)) return [];
          pendingEvents.push(eventId);
          return [{ event_id: eventId }];
        },
        findOneBy: async () => null,
        create: (_entity: unknown, plain: Partial<Notification>) => Object.assign(new Notification(), plain),
        save: async (n: Notification) => {
          Object.assign(n, { id: crypto.randomUUID(), isRead: false, createdAt: new Date() });
          pendingRows.push(n);
          return n;
        },
      } as unknown as EntityManager;
      try {
        const result = await work(manager);
        pendingEvents.forEach((id) => processed.add(id));
        notifications.push(...pendingRows);
        dataSource.subscribers.forEach((s) => s.afterTransactionCommit?.({ queryRunner } as never));
        return result;
      } catch (error) {
        dataSource.subscribers.forEach((s) => s.afterTransactionRollback?.({ queryRunner } as never));
        throw error;
      }
    },
  };
  return { dataSource: dataSource as unknown as DataSource, notifications };
}

function setup() {
  const db = fakeDatabase();
  const stream = new NotificationStream();
  const push = jest.spyOn(stream, 'push');
  const service = new NotificationsService(
    {} as Repository<Notification>,
    {} as Repository<never>,
    stream,
    db.dataSource,
  );
  const inbox = new InboxService(db.dataSource);
  return { ...db, push, inbox, welcome: new WelcomeHandler(service), petEvents: new PetEventsHandler(service) };
}

describe('Обработчики событий', () => {
  it('повторная доставка pet.hungry не создаёт второе уведомление и не дублирует поток', async () => {
    const { inbox, petEvents, notifications, push } = setup();
    const envelope = createEnvelope(RoutingKey.PetHungry, { ...pet, since: '2026-11-05T10:15:00Z' });

    await inbox.process(envelope, petEvents);
    await inbox.process(JSON.parse(JSON.stringify(envelope)) as EventEnvelope, petEvents);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ userId: USER, petId: PET, type: NotificationType.PET_HUNGRY });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('повторная доставка user.registered – одно приветствие', async () => {
    const { inbox, welcome, notifications } = setup();
    const envelope = createEnvelope(RoutingKey.UserRegistered, {
      userId: USER,
      login: 'masha',
      nickname: 'Маша',
      registeredAt: '2026-11-05T10:00:00Z',
    });

    await inbox.process(envelope, welcome);
    await inbox.process(envelope, welcome);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ userId: USER, type: NotificationType.WELCOME, petId: null });
  });

  it('разные события об одном питомце дают разные уведомления', async () => {
    const { inbox, petEvents, notifications } = setup();

    await inbox.process(createEnvelope(RoutingKey.PetHungry, { ...pet, since: '2026-11-05T10:15:00Z' }), petEvents);
    await inbox.process(createEnvelope(RoutingKey.PetSick, { ...pet, cause: 'POOP' }), petEvents);

    expect(notifications.map((n) => n.type)).toEqual([NotificationType.PET_HUNGRY, NotificationType.PET_SICK]);
  });
});

describe('NotificationTexts', () => {
  it('приветствие обращается по нику', () => {
    const n = NotificationTexts.welcome({ userId: USER, login: 'masha', nickname: 'Маша', registeredAt: '' });

    expect(n).toMatchObject({ userId: USER, type: NotificationType.WELCOME, title: 'Добро пожаловать!' });
    expect(n.body).toContain('Маша');
    expect(n.petId).toBeUndefined();
  });

  it.each([
    [RoutingKey.PetHungry, { since: '' }, NotificationType.PET_HUNGRY, 'Питомец голоден', 'Пушок давно ничего не ел'],
    [RoutingKey.PetSick, { cause: 'POOP' }, NotificationType.PET_SICK, 'Питомец заболел', 'Пушок заболел'],
    [
      RoutingKey.PetEvolved,
      { fromStage: 'TEEN', toStage: 'ADULT', formCode: 'adult_good', careMistakes: 1 },
      NotificationType.PET_EVOLVED,
      'Питомец вырос',
      'теперь он взрослый',
    ],
    [RoutingKey.PetDied, { cause: 'OLD_AGE', ageDays: 7 }, NotificationType.PET_DIED, 'Питомец умер', 'от старости'],
  ])('%s → владельцу питомца', (key, extra, type, title, body) => {
    const n = NotificationTexts.forPet(createEnvelope(key, { ...pet, ...extra }));

    expect(n).toMatchObject({ userId: USER, petId: PET, type, title });
    expect(n.body).toContain(body);
    expect(n.title.length).toBeLessThanOrEqual(96);
  });

  it('неизвестный тип события – ошибка (сообщение уйдёт в DLQ)', () => {
    expect(() => NotificationTexts.forPet(createEnvelope('pet.hatched', pet))).toThrow('pet.hatched');
  });
});
