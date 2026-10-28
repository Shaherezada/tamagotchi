import { createEnvelope, EventEnvelope } from '@app/contracts';
import type { DataSource, EntityManager } from 'typeorm';
import type { EventHandler } from '../rabbitmq/event-handler';
import { InboxService } from './inbox.service';

/** Имитация processed_events: INSERT ... ON CONFLICT DO NOTHING RETURNING и откат при ошибке. */
function fakeDataSource(): { dataSource: DataSource; processed: Set<string> } {
  const processed = new Set<string>();
  const dataSource = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const pending = new Set<string>();
      const manager = {
        query: async (_sql: string, [eventId]: [string, string]) => {
          if (processed.has(eventId) || pending.has(eventId)) {
            return [];
          }
          pending.add(eventId);
          return [{ event_id: eventId }];
        },
      } as unknown as EntityManager;
      const result = await work(manager);
      pending.forEach((id) => processed.add(id));
      return result;
    },
  } as unknown as DataSource;
  return { dataSource, processed };
}

function handler(impl: (envelope: EventEnvelope) => Promise<void> = async () => undefined): EventHandler {
  return { routingKeys: ['user.registered'], handle: jest.fn(impl) };
}

describe('InboxService', () => {
  const envelope = createEnvelope('user.registered', { userId: 'u1', login: 'masha', nickname: 'Маша' });

  it('обрабатывает событие один раз, повторная доставка того же eventId пропускается', async () => {
    const { dataSource } = fakeDataSource();
    const inbox = new InboxService(dataSource);
    const starterKit = handler();

    await inbox.process(envelope, starterKit);
    await inbox.process({ ...envelope }, starterKit);

    expect(starterKit.handle).toHaveBeenCalledTimes(1);
  });

  it('передаёт обработчику менеджер той же транзакции', async () => {
    const { dataSource } = fakeDataSource();
    const inbox = new InboxService(dataSource);
    const starterKit = handler();

    await inbox.process(envelope, starterKit);

    expect(starterKit.handle).toHaveBeenCalledWith(envelope, expect.objectContaining({ query: expect.any(Function) }));
  });

  it('если обработчик упал, событие не отмечается и при повторе обрабатывается снова', async () => {
    const { dataSource, processed } = fakeDataSource();
    const inbox = new InboxService(dataSource);
    const failing = handler(async () => {
      throw new Error('база недоступна');
    });

    await expect(inbox.process(envelope, failing)).rejects.toThrow('база недоступна');
    expect(processed.has(envelope.eventId)).toBe(false);

    const ok = handler();
    await inbox.process(envelope, ok);
    expect(ok.handle).toHaveBeenCalledTimes(1);
  });

  it('разные события обрабатываются независимо', async () => {
    const { dataSource } = fakeDataSource();
    const inbox = new InboxService(dataSource);
    const starterKit = handler();

    await inbox.process(envelope, starterKit);
    await inbox.process(createEnvelope('user.registered', { userId: 'u2' }), starterKit);

    expect(starterKit.handle).toHaveBeenCalledTimes(2);
  });
});
