import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { IconDto } from './dto/icon.dto';
import { ItemDto } from './dto/item.dto';
import { ItemsQuery } from './dto/items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { IconStorage } from './icon-storage';
import { Item } from './item.entity';
import { CATALOG_ALL, ItemCatalogCache } from './item-catalog.cache';
import { toItemDto } from './item.mapper';

const ICON_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    private readonly cache: ItemCatalogCache,
    private readonly icons: IconStorage,
  ) {}

  /** Активные предметы; ответ кэшируется в Redis. */
  async list(query: ItemsQuery): Promise<ItemDto[]> {
    const key = query.category ?? CATALOG_ALL;
    const cached = await this.cache.get(key);
    if (cached) {
      return cached;
    }
    const items = await this.items.find({
      where: { isActive: true, ...(query.category ? { category: query.category } : {}) },
      order: { category: 'ASC', price: 'ASC', code: 'ASC' },
    });
    const dtos = items.map((item) => toItemDto(item, this.icons));
    await this.cache.set(key, dtos);
    return dtos;
  }

  async get(itemId: string): Promise<ItemDto> {
    return toItemDto(await this.find(itemId), this.icons);
  }

  async create(dto: CreateItemDto): Promise<ItemDto> {
    if (await this.items.exists({ where: { code: dto.code } })) {
      throw this.codeTaken(dto.code);
    }
    let item: Item;
    try {
      item = await this.items.save(this.items.create({ ...dto, isActive: true, iconKey: null }));
    } catch (error) {
      // одновременное создание с тем же кодом
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw this.codeTaken(dto.code);
      }
      throw error;
    }
    await this.cache.invalidate();
    return toItemDto(item, this.icons);
  }

  async update(itemId: string, dto: UpdateItemDto): Promise<ItemDto> {
    const item = await this.find(itemId);
    for (const [field, value] of Object.entries(dto)) {
      if (value !== undefined) {
        Object.assign(item, { [field]: value });
      }
    }
    const saved = await this.items.save(item);
    await this.cache.invalidate();
    return toItemDto(saved, this.icons);
  }

  /** Иконка – items/<itemId>.<ext> в Silo; в БД только ключ. */
  async uploadIcon(itemId: string, file: Express.Multer.File): Promise<IconDto> {
    const item = await this.find(itemId);
    const key = `items/${item.id}.${ICON_EXTENSIONS[file.mimetype]}`;
    await this.icons.put(key, file.buffer, file.mimetype);
    await this.items.update({ id: item.id }, { iconKey: key });
    await this.cache.invalidate();
    return { iconUrl: this.icons.url(key) };
  }

  private async find(itemId: string): Promise<Item> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) {
      throw ProblemException.notFound('Предмет не найден', `Нет предмета ${itemId}`, 'item-not-found');
    }
    return item;
  }

  private codeTaken(code: string): ProblemException {
    return ProblemException.conflict('item-code-taken', 'Код предмета занят', `Предмет с кодом ${code} уже есть`);
  }
}
