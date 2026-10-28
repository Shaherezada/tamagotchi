import type { PetSnapshot } from '@app/contracts';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Item } from '../items/item.entity';
import { CareStatus, CareType } from './care-enums';

/** Действие ухода – шаг саги (§9): PENDING до ответа pets-service, затем APPLIED или REJECTED. */
@Entity('care_actions')
export class CareAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'pet_id', type: 'uuid' })
  petId: string;

  @Column({ type: 'varchar', length: 12 })
  type: CareType;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: Item | null;

  @Column({ type: 'varchar', length: 10, default: CareStatus.PENDING })
  status: CareStatus;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ type: 'jsonb', nullable: true })
  result: PetSnapshot | null;

  @Column({ name: 'reject_reason', type: 'varchar', length: 32, nullable: true })
  rejectReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
