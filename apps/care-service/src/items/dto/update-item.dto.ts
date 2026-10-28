import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateItemDto } from './create-item.dto';

/** Все поля нового предмета необязательны; код не меняется – на него ссылаются стартовый набор и сид. */
export class UpdateItemDto extends PartialType(OmitType(CreateItemDto, ['code'] as const)) {
  @ApiPropertyOptional({ description: 'false – предмет снят с продажи' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
