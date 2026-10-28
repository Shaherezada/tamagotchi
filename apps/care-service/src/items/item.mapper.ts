import type { ItemDto } from './dto/item.dto';
import type { IconStorage } from './icon-storage';
import type { Item } from './item.entity';

export function toItemDto(item: Item, icons: IconStorage): ItemDto {
  return {
    id: item.id,
    code: item.code,
    title: item.title,
    description: item.description,
    category: item.category,
    price: item.price,
    isConsumable: item.isConsumable,
    hungerDelta: item.hungerDelta,
    happinessDelta: item.happinessDelta,
    weightDelta: item.weightDelta,
    curesSickness: item.curesSickness,
    iconUrl: item.iconKey ? icons.url(item.iconKey) : null,
  };
}
