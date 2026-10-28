import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pet } from './pet.entity';

/** Строка хронологии жизни питомца. */
@Entity('pet_events')
export class PetEvent {
  // BIGSERIAL: pg отдаёт bigint строкой
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => Pet, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ type: 'varchar', length: 16 })
  type: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  details: object;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
