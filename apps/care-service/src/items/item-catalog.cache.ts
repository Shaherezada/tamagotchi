import { InjectRedis } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Category } from './category.enum';
import type { ItemDto } from './dto/item.dto';

/** Ключ кэша каталога: care:items:<category>, для всех категорий – care:items:all. */
export const CATALOG_CACHE_PREFIX = 'care:items:';
export const CATALOG_CACHE_TTL_SECONDS = 5 * 60;
export const CATALOG_ALL = 'all';

const CATALOG_KEYS = [CATALOG_ALL, ...Object.values(Category)].map((c) => CATALOG_CACHE_PREFIX + c);

/**
 * Кэш каталога в Redis (§12): TTL 5 минут, сброс при любом изменении каталога.
 * Redis недоступен – каталог читается из БД: кэш лишь ускоряет ответ.
 */
@Injectable()
export class ItemCatalogCache {
  private readonly logger = new Logger(ItemCatalogCache.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(category: string): Promise<ItemDto[] | null> {
    try {
      const cached = await this.redis.get(CATALOG_CACHE_PREFIX + category);
      return cached ? (JSON.parse(cached) as ItemDto[]) : null;
    } catch (error) {
      this.logger.warn(`Кэш каталога недоступен: ${(error as Error).message}`);
      return null;
    }
  }

  async set(category: string, items: ItemDto[]): Promise<void> {
    try {
      await this.redis.set(CATALOG_CACHE_PREFIX + category, JSON.stringify(items), 'EX', CATALOG_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Кэш каталога не записан: ${(error as Error).message}`);
    }
  }

  // ключей немного и все известны заранее, поэтому без SCAN
  async invalidate(): Promise<void> {
    try {
      await this.redis.del(...CATALOG_KEYS);
    } catch (error) {
      this.logger.warn(`Кэш каталога не сброшен: ${(error as Error).message}`);
    }
  }
}
