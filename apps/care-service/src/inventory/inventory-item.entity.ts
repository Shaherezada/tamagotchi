import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Item } from '../items/item.entity';

/** Предметы игрока: составной ключ (user_id, item_id). */
@Entity('inventory_items')
export class InventoryItem {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  // TypeORM не делает связь частью первичного ключа, поэтому item_id – ещё и отдельная колонка
  @PrimaryColumn({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
