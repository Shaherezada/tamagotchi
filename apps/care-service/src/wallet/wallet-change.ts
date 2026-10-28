import type { Reason } from './reason.enum';

/** Изменение баланса: amount > 0; credit прибавляет, debit списывает. */
export interface WalletChange {
  userId: string;
  amount: number;
  reason: Reason;
  referenceId?: string;
}
