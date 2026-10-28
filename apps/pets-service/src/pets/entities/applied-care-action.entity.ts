import type { PetSnapshot } from '@app/contracts';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Pet } from './pet.entity';

/** Применённое действие ухода: повтор gRPC с тем же actionId вернёт сохранённый результат. */
@Entity('applied_care_actions')
export class AppliedCareAction {
  @PrimaryColumn({ name: 'action_id', type: 'uuid' })
  actionId: string;

  @ManyToOne(() => Pet, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ type: 'varchar', length: 12 })
  type: string;

  @Column({ type: 'jsonb' })
  result: PetSnapshot;

  @Column({ name: 'applied_at', type: 'timestamptz' })
  appliedAt: Date;
}
