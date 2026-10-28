/**
 * Сценарий демо защиты против поднятого docker compose (через nginx :8080).
 * Шаги зависят друг от друга и идут по порядку; асинхронное ждётся опросом с таймаутом.
 */
import type Redis from 'ioredis';
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  api,
  BASE_URL,
  compose,
  jwtPayload,
  listenEvents,
  openSse,
  PNG_1X1,
  redis,
  uniqueLogin,
  waitFor,
} from './support';

interface Token {
  userId: string;
  accessToken: string;
}
interface Pet {
  id: string;
  stage: string;
  hunger: number;
  happiness: number;
  careMistakes: number;
  attention: string | null;
}
interface Item {
  id: string;
  code: string;
  price: number;
  hungerDelta: number;
  iconUrl: string | null;
}
interface InventoryRow {
  item: Item;
  quantity: number;
}
interface Notification {
  id: string;
  type: string;
  petId: string | null;
}
interface CareAction {
  id: string;
  status: string;
  rejectReason: string | null;
}
interface CareResult {
  action: CareAction;
  pet: Pet & { careMistakeMade: boolean };
}
interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}

const PASSWORD = 'secret123';

describe('Тамагочи: сценарий демо защиты', () => {
  const login = uniqueLogin('e2e');
  let player: Token;
  let admin: Token;
  let pet: Pet;
  let items: Record<string, Item>;
  let events: Awaited<ReturnType<typeof listenEvents>>;
  let cache: Redis;

  const inventory = async () => {
    const { body } = await api<InventoryRow[]>('GET', '/api/inventory', { token: player.accessToken });
    return Object.fromEntries(body.map((row) => [row.item.code, row.quantity])) as Record<string, number>;
  };
  const notifications = async () =>
    (await api<{ items: Notification[] }>('GET', '/api/notifications', { token: player.accessToken })).body.items;
  const getPet = async () => (await api<Pet>('GET', `/api/pets/${pet.id}`, { token: player.accessToken })).body;
  const care = (type: string, itemCode?: string) =>
    api<CareResult & Problem>('POST', '/api/care-actions', {
      token: player.accessToken,
      json: { petId: pet.id, type, ...(itemCode ? { itemId: items[itemCode].id } : {}) },
    });
  const timeTravel = (gameMinutes: number) =>
    api<Pet>('POST', `/api/admin/pets/${pet.id}/time-travel`, { token: admin.accessToken, json: { gameMinutes } });

  beforeAll(async () => {
    events = await listenEvents('user.registered', 'pet.*');
    cache = redis();
    const signedIn = await api<Token>('POST', '/api/auth/login', {
      json: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
    });
    if (signedIn.status !== 200) {
      throw new Error(`Вход админа ${ADMIN_LOGIN}: ${signedIn.status}. Запущен ли сид users-service?`);
    }
    admin = signedIn.body;
    const catalog = await api<Item[]>('GET', '/api/items');
    items = Object.fromEntries(catalog.body.map((item) => [item.code, item]));
  });

  afterAll(async () => {
    await events?.close();
    cache?.disconnect();
  });

  it('1. регистрация: user.registered в RabbitMQ, 100 монет, стартовый набор, приветствие', async () => {
    const registered = await api<Token>('POST', '/api/auth/register', {
      json: { login, nickname: 'Тестер', password: PASSWORD },
    });
    expect(registered.status).toBe(201);
    player = registered.body;
    expect(jwtPayload(player.accessToken)).toMatchObject({ sub: player.userId, role: 'player' });

    const event = await waitFor('user.registered в RabbitMQ', async () =>
      events.received.find((e) => e.routingKey === 'user.registered' && e.body.payload.userId === player.userId),
    );
    expect(event.body).toMatchObject({ type: 'user.registered', version: 1, payload: { login } });

    const wallet = await waitFor('кошелёк 100 монет', async () => {
      const { status, body } = await api<{ balance: number }>('GET', '/api/wallet', { token: player.accessToken });
      return status === 200 && body.balance === 100 && body;
    });
    expect(wallet.balance).toBe(100);
    expect(await inventory()).toEqual({ rice: 3, candy: 2, pill: 1, ball: 1 });

    const welcome = await waitFor('приветственное уведомление', async () =>
      (await notifications()).find((n) => n.type === 'WELCOME'),
    );
    expect(welcome.petId).toBeNull();
  });

  it('2. завести питомца – яйцо', async () => {
    const created = await api<Pet>('POST', '/api/pets', { token: player.accessToken, json: { name: 'Пушок' } });
    expect(created.status).toBe(201);
    pet = created.body;
    expect(pet.stage).toBe('EGG');
    expect(pet.hunger).toBe(4);
  });

  it('3. админ перематывает 5 минут – яйцо вылупилось, уведомление «вырос»', async () => {
    const travelled = await timeTravel(5);
    expect(travelled.status).toBe(200);
    expect(travelled.body.stage).toBe('BABY');

    await waitFor('pet.evolved в RabbitMQ', async () =>
      events.received.find((e) => e.routingKey === 'pet.evolved' && e.body.payload.petId === pet.id),
    );
    const evolved = await waitFor('уведомление «Питомец вырос»', async () =>
      (await notifications()).find((n) => n.type === 'PET_EVOLVED' && n.petId === pet.id),
    );
    expect(evolved).toBeDefined();
  });

  it('4. перемотка до голода – pet.hungry, уведомление в списке и в SSE', async () => {
    const stream = await openSse('/api/notifications/stream', player.accessToken);
    try {
      expect(stream.status).toBe(200);
      expect(stream.contentType).toContain('text/event-stream');

      // от рождения прошло 5 мин, сытость падает раз в 30 мин: 0 – через 120 мин после рождения
      const travelled = await timeTravel(120);
      expect(travelled.status).toBe(200);
      expect(travelled.body.hunger).toBe(0);
      expect(travelled.body.attention).toBe('HUNGRY');

      await waitFor('pet.hungry в RabbitMQ', async () =>
        events.received.find((e) => e.routingKey === 'pet.hungry' && e.body.payload.petId === pet.id),
      );
      await waitFor('уведомление «Питомец голоден» в списке', async () =>
        (await notifications()).find((n) => n.type === 'PET_HUNGRY' && n.petId === pet.id),
      );
      const pushed = await waitFor('уведомление в потоке SSE', async () =>
        stream.events.find((e) => (e.data as Notification).type === 'PET_HUNGRY'),
      );
      expect(pushed.event).toBe('notification');
    } finally {
      await stream.close();
    }
  });

  it('5. покормить рисом – в инвентаре на одну меньше, сытость выросла на дельту предмета', async () => {
    const before = await inventory();
    const fed = await care('FEED', 'rice');
    expect(fed.status).toBe(200);
    expect(fed.body.action.status).toBe('APPLIED');
    expect(fed.body.pet.hunger).toBe(items.rice.hungerDelta);
    expect((await inventory()).rice).toBe(before.rice - 1);
    expect((await getPet()).hunger).toBe(items.rice.hungerDelta);
  });

  it('6. покормить сытого – ошибка ухода', async () => {
    const bought = await api('POST', '/api/purchases', {
      token: player.accessToken,
      json: { itemId: items.fish.id, quantity: 2 },
    });
    expect(bought.status).toBe(201);
    for (let i = 0; i < 2; i++) {
      expect((await care('FEED', 'fish')).status).toBe(200);
    }
    const full = await getPet();
    expect(full.hunger).toBe(4);

    const overfed = await care('FEED', 'rice');
    expect(overfed.status).toBe(200);
    expect(overfed.body.pet.careMistakeMade).toBe(true);
    expect(overfed.body.pet.careMistakes).toBe(full.careMistakes + 1);
  });

  it('7. pets-service остановлен – 503 и PENDING; после старта досылка проводит действие', async () => {
    const before = await getPet();
    const candies = (await inventory()).candy;
    compose('stop', 'pets-service');
    let actionId: string;
    try {
      const failed = await care('SNACK', 'candy');
      expect(failed.status).toBe(503);
      expect(failed.contentType).toContain('application/problem+json');
      expect(failed.body.type).toMatch(/pets-unavailable$/);

      const { body: history } = await api<CareAction[]>('GET', '/api/care-actions?limit=1', {
        token: player.accessToken,
      });
      expect(history[0].status).toBe('PENDING');
      actionId = history[0].id;
      // предмет списан до ответа pets-service
      expect((await inventory()).candy).toBe(candies - 1);
    } finally {
      compose('start', 'pets-service');
    }

    await waitFor(
      'pets-service снова отвечает через nginx',
      async () => (await fetch(`${BASE_URL}/docs/pets-json`)).status === 200,
      { timeoutMs: 120_000, intervalMs: 1_000 },
    );
    const applied = await waitFor(
      'досылка провела действие (APPLIED)',
      async () => {
        const { body } = await api<CareAction[]>('GET', '/api/care-actions?limit=5', { token: player.accessToken });
        const action = body.find((a) => a.id === actionId);
        return action && action.status !== 'PENDING' && action;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 },
    );
    expect(applied.status).toBe('APPLIED');
    expect((await getPet()).happiness).toBe(Math.min(4, before.happiness + 1));
    expect((await inventory()).candy).toBe(candies - 1);
  });

  it('8. покупка без денег – 409 problem+json', async () => {
    const response = await api<Problem>('POST', '/api/purchases', {
      token: player.accessToken,
      json: { itemId: items.teddy.id, quantity: 99 },
    });
    expect(response.status).toBe(409);
    expect(response.contentType).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      type: expect.stringMatching(/\/insufficient-funds$/),
      status: 409,
      instance: '/api/purchases',
    });
    expect(response.body.title).toBeTruthy();
  });

  it('9. выход – старый токен отклоняет другой сервис (отзыв в Redis)', async () => {
    const { jti } = jwtPayload(player.accessToken);
    expect((await api('POST', '/api/auth/logout', { token: player.accessToken })).status).toBe(204);
    expect(await cache.exists(`auth:revoked:${jti}`)).toBe(1);

    const rejected = await api<Problem>('GET', '/api/pets', { token: player.accessToken });
    expect(rejected.status).toBe(401);
    expect(rejected.contentType).toContain('application/problem+json');
    expect((await api('GET', '/api/wallet', { token: player.accessToken })).status).toBe(401);

    // новый вход – новый токен работает
    const again = await api<Token>('POST', '/api/auth/login', { json: { login, password: PASSWORD } });
    expect(again.status).toBe(200);
    expect((await api('GET', '/api/pets', { token: again.body.accessToken })).status).toBe(200);
  });

  it('10. админ загружает иконку – объект в Silo; каталог отдаётся из кэша Redis', async () => {
    const form = new FormData();
    form.append('icon', new Blob([PNG_1X1], { type: 'image/png' }), 'teddy.png');
    const uploaded = await api<{ iconUrl: string }>('PUT', `/api/items/${items.teddy.id}/icon`, {
      token: admin.accessToken,
      form,
    });
    expect(uploaded.status).toBe(200);
    const object = await fetch(uploaded.body.iconUrl);
    expect(object.status).toBe(200);
    expect(object.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await object.arrayBuffer()).equals(PNG_1X1)).toBe(true);

    // загрузка сбросила кэш; первый запрос кладёт каталог в Redis, второй читает оттуда
    const first = await api<Item[]>('GET', '/api/items');
    expect(first.body.find((item) => item.code === 'teddy')?.iconUrl).toBe(uploaded.body.iconUrl);
    const cached = await cache.get('care:items:all');
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!)).toEqual(first.body);
    const ttl = await cache.ttl('care:items:all');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);

    // метка в значении кэша видна в ответе – значит, каталог пришёл из Redis, а не из БД
    const marked = first.body.map((item) => ({ ...item, title: `${item.code} из кэша` }));
    await cache.set('care:items:all', JSON.stringify(marked), 'KEEPTTL');
    try {
      expect((await api<Item[]>('GET', '/api/items')).body).toEqual(marked);
    } finally {
      await cache.del('care:items:all');
    }
  });
});
