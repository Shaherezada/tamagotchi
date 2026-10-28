import { ApiProperty } from '@nestjs/swagger';

export class PurchaseResultDto {
  @ApiProperty({ format: 'uuid' })
  purchaseId: string;

  @ApiProperty({ format: 'uuid' })
  itemId: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 10 })
  totalPrice: number;

  @ApiProperty({ example: 90, description: 'Баланс после покупки' })
  balance: number;
}
