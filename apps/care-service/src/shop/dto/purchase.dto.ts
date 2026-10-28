import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class PurchaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ minimum: 1, maximum: 99, example: 2 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}
