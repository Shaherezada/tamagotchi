import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CareType } from '../care-enums';

export class CreateCareActionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  petId: string;

  @ApiProperty({ enum: CareType, enumName: 'CareType', example: CareType.FEED })
  @IsEnum(CareType)
  type: CareType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Предмет из инвентаря: FEED – еда, SNACK – лакомство, HEAL – лекарство, PLAY – игрушка',
  })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
