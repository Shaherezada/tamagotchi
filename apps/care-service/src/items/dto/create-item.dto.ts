import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Category } from '../category.enum';

export class CreateItemDto {
  @ApiProperty({ example: 'rice', pattern: '^[a-z0-9_]{2,32}$', description: 'Неизменяемый код предмета' })
  @Matches(/^[a-z0-9_]{2,32}$/, { message: 'code: 2–32 символа, строчные латинские буквы, цифры и _' })
  code: string;

  @ApiProperty({ example: 'Рис', minLength: 1, maxLength: 64 })
  @IsString()
  @Length(1, 64)
  title: string;

  @ApiProperty({ example: 'Простая сытная еда', maxLength: 256 })
  @IsString()
  @MaxLength(256)
  description: string;

  @ApiProperty({ enum: Category, enumName: 'Category' })
  @IsEnum(Category)
  category: Category;

  @ApiProperty({ minimum: 0, maximum: 100000, example: 5, description: 'Цена в монетах' })
  @IsInt()
  @Min(0)
  @Max(100000)
  price: number;

  @ApiProperty({ description: 'Тратится при использовании (игрушка – нет)', example: true })
  @IsBoolean()
  isConsumable: boolean;

  @ApiProperty({ minimum: -4, maximum: 4, example: 1, description: 'Изменение сытости, сердечки' })
  @IsInt()
  @Min(-4)
  @Max(4)
  hungerDelta: number;

  @ApiProperty({ minimum: -4, maximum: 4, example: 0, description: 'Изменение настроения, сердечки' })
  @IsInt()
  @Min(-4)
  @Max(4)
  happinessDelta: number;

  @ApiProperty({ minimum: -10, maximum: 10, example: 1, description: 'Изменение веса' })
  @IsInt()
  @Min(-10)
  @Max(10)
  weightDelta: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  curesSickness: boolean;
}
