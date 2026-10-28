import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
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

  /** Кошелёк появляется со стартовым набором; до него у игрока 0 монет и пустой журнал. */
  async get(userId: string, limit: number): Promise<WalletDto> {
    const wallet = await this.wallets.findOne({ where: { userId } });
    const transactions = await this.journal.find({
      where: { wallet: { userId } },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
    return {
      balance: wallet?.balance ?? 0,
      transactions: transactions.map((t) => ({
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        reason: t.reason,
        createdAt: t.createdAt,
      })),
    };
  }

  /** Начисление в транзакции вызывающего: кошелёк FOR UPDATE, баланс, строка журнала. Возвращает новый баланс. */
  async credit(manager: EntityManager, change: WalletChange): Promise<number> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values({ userId: change.userId, balance: 0 })
      .orIgnore()
      .execute();
    const wallet = await this.lock(manager, change.userId);
    return this.apply(manager, wallet!, change, change.amount);
  }

  /** Списание в транзакции вызывающего; не хватает монет – 409 insufficient-funds. Возвращает новый баланс. */
  async debit(manager: EntityManager, change: WalletChange): Promise<number> {
    const wallet = await this.lock(manager, change.userId);
    const balance = wallet?.balance ?? 0;
    if (balance < change.amount) {
      throw ProblemException.conflict(
        'insufficient-funds',
        'Недостаточно монет',
        `Нужно ${change.amount} монет, на счету ${balance}`,
      );
    }
    return wallet ? this.apply(manager, wallet, change, -change.amount) : 0;
  }

  private lock(manager: EntityManager, userId: string): Promise<Wallet | null> {
    return manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
  }

  // нулевая сумма (бесплатный предмет) журнал не трогает: строка с amount = 0 запрещена CHECK
  private async apply(manager: EntityManager, wallet: Wallet, change: WalletChange, amount: number): Promise<number> {
    if (amount === 0) {
      return wallet.balance;
    }
    wallet.balance += amount;
    await manager.save(Wallet, wallet);
    await manager.save(WalletTransaction, {
      wallet: { userId: wallet.userId },
      amount,
      balanceAfter: wallet.balance,
      reason: change.reason,
      referenceId: change.referenceId ?? null,
    });
    return wallet.balance;
  }
}
