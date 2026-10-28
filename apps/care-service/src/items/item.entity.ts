import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Category } from './category.enum';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  title: string;

  @Column({ type: 'varchar', length: 256 })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  category: Category;

  @Column({ type: 'integer' })
  price: number;

  @Column({ name: 'is_consumable', type: 'boolean' })
  isConsumable: boolean;

  @Column({ name: 'hunger_delta', type: 'smallint', default: 0 })
  hungerDelta: number;

  @Column({ name: 'happiness_delta', type: 'smallint', default: 0 })
  happinessDelta: number;

  @Column({ name: 'weight_delta', type: 'smallint', default: 0 })
  weightDelta: number;

  @Column({ name: 'cures_sickness', type: 'boolean', default: false })
  curesSickness: boolean;

  @Column({ name: 'icon_key', type: 'varchar', length: 128, nullable: true })
  iconKey: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
