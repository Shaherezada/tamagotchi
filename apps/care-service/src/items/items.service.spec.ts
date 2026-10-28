import { careFixture } from '../../test/care-fixtures';
import { Category } from './category.enum';
import type { IconStorage } from './icon-storage';
import { Item } from './item.entity';
import { CATALOG_CACHE_PREFIX, CATALOG_CACHE_TTL_SECONDS, ItemCatalogCache } from './item-catalog.cache';
import { ItemsService } from './items.service';
import type Redis from 'ioredis';
import type { Repository } from 'typeorm';

/** Redis в памяти: get / set EX / del. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    del: jest.fn(async (...keys: string[]) => keys.forEach((k) => store.delete(k))),
  };
}

describe('ItemsService – каталог и кэш Redis', () => {
  function setup() {
    const care = careFixture();
    const redis = fakeRedis();
    const repository = care.db.repository(Item);
    const find = jest.spyOn(repository, 'find');
    const items = Object.assign(repository, {
      exists: async () => false,
      save: async (item: Item) => care.db.insert(Item, item),
      create: (item: Partial<Item>) => item,
      update: jest.fn(),
    }) as unknown as Repository<Item>;
    const icons = { ...care.icons, put: jest.fn() } as unknown as IconStorage;
    const service = new ItemsService(items, new ItemCatalogCache(redis as unknown as Redis), icons);
    return { ...care, redis, find, service };
  }

  it('первый запрос – из БД и в кэш на 5 минут, второй – из кэша без БД', async () => {
    const { service, redis, find } = setup();

    const first = await service.list({ category: Category.FOOD });
    const second = await service.list({ category: Category.FOOD });

    expect(first.map((i) => i.code)).toEqual(['rice', 'fish']);
    expect(second).toEqual(first);
    expect(find).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      `${CATALOG_CACHE_PREFIX}FOOD`,
      expect.any(String),
      'EX',
      CATALOG_CACHE_TTL_SECONDS,
    );
  });

  it('изменение каталога сбрасывает кэш всех категорий', async () => {
    const { service, redis, find, items } = setup();
    await service.list({});
    await service.list({ category: Category.TOY });

    await service.update(items.ball.id, { price: 25 });
    const toys = await service.list({ category: Category.TOY });

    expect(redis.store.size).toBe(1);
    expect(find).toHaveBeenCalledTimes(3);
    expect(toys.find((i) => i.code === 'ball')?.price).toBe(25);
  });

  it('Redis недоступен – каталог всё равно отдаётся из БД', async () => {
    const { service, redis } = setup();
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.list({})).resolves.toHaveLength(7);
  });
});
