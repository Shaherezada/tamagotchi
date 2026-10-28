import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { IconDto } from './dto/icon.dto';
import { ItemDto } from './dto/item.dto';
import { ItemsQuery } from './dto/items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { IconStorage } from './icon-storage';
import { Item } from './item.entity';
import { ItemCatalogCache } from './item-catalog.cache';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    private readonly cache: ItemCatalogCache,
    private readonly icons: IconStorage,
  ) {}

  /** Активные предметы; ответ кэшируется в Redis. */
  list(_query: ItemsQuery): Promise<ItemDto[]> {
    throw new NotImplementedException();
  }

  get(_itemId: string): Promise<ItemDto> {
    throw new NotImplementedException();
  }

  create(_dto: CreateItemDto): Promise<ItemDto> {
    throw new NotImplementedException();
  }

  update(_itemId: string, _dto: UpdateItemDto): Promise<ItemDto> {
    throw new NotImplementedException();
  }

  uploadIcon(_itemId: string, _file: Express.Multer.File): Promise<IconDto> {
    throw new NotImplementedException();
  }
}
