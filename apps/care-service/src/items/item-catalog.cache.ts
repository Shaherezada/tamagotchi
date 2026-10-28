import { InjectRedis } from '@app/common';
import { Injectable, NotImplementedException } from '@nestjs/common';
import Redis from 'ioredis';
import type { ItemDto } from './dto/item.dto';

/** Ключ кэша каталога: care:items:<category>, для всех категорий – care:items:all. */
export const CATALOG_CACHE_PREFIX = 'care:items:';
export const CATALOG_CACHE_TTL_SECONDS = 5 * 60;

/** Кэш каталога в Redis (§12): TTL 5 минут, сброс при любом изменении каталога. */
@Injectable()
export class ItemCatalogCache {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  get(_category: string): Promise<ItemDto[] | null> {
    throw new NotImplementedException();
  }

  set(_category: string, _items: ItemDto[]): Promise<void> {
    throw new NotImplementedException();
  }

  invalidate(): Promise<void> {
    throw new NotImplementedException();
  }
}
