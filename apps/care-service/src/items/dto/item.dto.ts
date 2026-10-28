import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../category.enum';

export class ItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'rice' })
  code: string;

  @ApiProperty({ example: 'Рис' })
  title: string;

  @ApiProperty({ example: 'Простая сытная еда' })
  description: string;

  @ApiProperty({ enum: Category, enumName: 'Category' })
  category: Category;

  @ApiProperty({ example: 5 })
  price: number;

  @ApiProperty({ example: true })
  isConsumable: boolean;

  @ApiProperty({ example: 1 })
  hungerDelta: number;

  @ApiProperty({ example: 0 })
  happinessDelta: number;

  @ApiProperty({ example: 1 })
  weightDelta: number;

  @ApiProperty({ example: false })
  curesSickness: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uri',
    example: 'http://localhost:9000/tamagotchi-media/items/3f1c2a4e-8b1d-4c7e-9f2a-5d6b7c8e9f01.png',
  })
  iconUrl: string | null;
}
