import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { WalletDto } from './dto/wallet.dto';
import type { WalletChange } from './wallet-change';
import { WalletTransaction } from './wallet-transaction.entity';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private readonly journal: Repository<WalletTransaction>,
  ) {}

  get(_userId: string, _limit: number): Promise<WalletDto> {
    throw new NotImplementedException();
  }

  /** Начисление в транзакции вызывающего: кошелёк FOR UPDATE, баланс, строка журнала. Возвращает новый баланс. */
  credit(_manager: EntityManager, _change: WalletChange): Promise<number> {
    throw new NotImplementedException();
  }

  /** Списание в транзакции вызывающего; не хватает монет – 409 insufficient-funds. Возвращает новый баланс. */
  debit(_manager: EntityManager, _change: WalletChange): Promise<number> {
    throw new NotImplementedException();
  }
}
