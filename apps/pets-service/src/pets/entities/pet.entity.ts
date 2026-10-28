import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Attention, DeathCause, Stage } from '../pet-enums';
import { PetForm } from './pet-form.entity';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'varchar', length: 24 })
  name: string;

  @Column({ type: 'varchar', length: 8 })
  stage: Stage;

  @ManyToOne(() => PetForm, { nullable: false })
  @JoinColumn({ name: 'form_code', referencedColumnName: 'code' })
  form: PetForm;

  @Column({ type: 'smallint' })
  hunger: number;

  @Column({ type: 'smallint' })
  happiness: number;

  @Column({ type: 'smallint' })
  discipline: number;

  @Column({ type: 'smallint' })
  weight: number;

  @Column({ name: 'poop_count', type: 'smallint' })
  poopCount: number;

  @Column({ name: 'is_sick', type: 'boolean', default: false })
  isSick: boolean;

  @Column({ name: 'is_sleeping', type: 'boolean', default: false })
  isSleeping: boolean;

  @Column({ type: 'varchar', length: 12, nullable: true })
  attention: Attention | null;

  @Column({ name: 'attention_since', type: 'timestamptz', nullable: true })
  attentionSince: Date | null;

  /** Ошибка за текущий зов уже засчитана (одна на эпизод). */
  @Column({ name: 'mistake_counted', type: 'boolean', default: false })
  mistakeCounted: boolean;

  @Column({ name: 'care_mistakes', type: 'smallint', default: 0 })
  careMistakes: number;

  @Column({ name: 'starving_since', type: 'timestamptz', nullable: true })
  starvingSince: Date | null;

  @Column({ name: 'born_at', type: 'timestamptz' })
  bornAt: Date;

  @Column({ name: 'stage_since', type: 'timestamptz' })
  stageSince: Date;

  @Column({ name: 'simulated_at', type: 'timestamptz' })
  simulatedAt: Date;

  @Column({ name: 'next_tick_at', type: 'timestamptz' })
  nextTickAt: Date;

  @Column({ name: 'died_at', type: 'timestamptz', nullable: true })
  diedAt: Date | null;

  @Column({ name: 'death_cause', type: 'varchar', length: 10, nullable: true })
  deathCause: DeathCause | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
