import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Category } from '../category.enum';

export class ItemsQuery {
  @ApiPropertyOptional({ enum: Category, enumName: 'Category', description: 'Без параметра – все категории' })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;
}
