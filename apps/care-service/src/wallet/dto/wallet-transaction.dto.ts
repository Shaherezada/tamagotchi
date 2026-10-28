import { ApiProperty } from '@nestjs/swagger';
import { Reason } from '../reason.enum';

export class WalletTransactionDto {
  @ApiProperty({ example: -10, description: 'Плюс – начисление, минус – списание' })
  amount: number;

  @ApiProperty({ example: 90 })
  balanceAfter: number;

  @ApiProperty({ enum: Reason, enumName: 'Reason' })
  reason: Reason;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
