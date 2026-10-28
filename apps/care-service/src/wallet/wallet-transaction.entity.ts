import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Reason } from './reason.enum';
import { Wallet } from './wallet.entity';

/** Строка журнала кошелька: каждое изменение баланса с остатком после него. */
@Entity('wallet_transactions')
export class WalletTransaction {
  // BIGSERIAL: pg отдаёт bigint строкой
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => Wallet, { nullable: false })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  wallet: Wallet;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 20 })
  reason: Reason;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
