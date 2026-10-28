import { ApiProperty } from '@nestjs/swagger';
import { ItemDto } from '../../items/dto/item.dto';

export class InventoryItemDto {
  @ApiProperty({ type: ItemDto })
  item: ItemDto;

  @ApiProperty({ example: 3 })
  quantity: number;
}
