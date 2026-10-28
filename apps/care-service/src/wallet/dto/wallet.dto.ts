import { ApiProperty } from '@nestjs/swagger';
import { WalletTransactionDto } from './wallet-transaction.dto';

export class WalletDto {
  @ApiProperty({ example: 90, description: 'Баланс в монетах' })
  balance: number;

  @ApiProperty({ type: [WalletTransactionDto], description: 'Последние операции, новые первыми' })
  transactions: WalletTransactionDto[];
}
