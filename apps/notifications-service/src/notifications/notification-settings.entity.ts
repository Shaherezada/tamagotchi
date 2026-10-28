import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Какие уведомления присылать игроку; нет строки – присылать все. */
@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'pet_hungry', type: 'boolean', default: true })
  petHungry: boolean;

  @Column({ name: 'pet_sick', type: 'boolean', default: true })
  petSick: boolean;

  @Column({ name: 'pet_evolved', type: 'boolean', default: true })
  petEvolved: boolean;

  @Column({ name: 'pet_died', type: 'boolean', default: true })
  petDied: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
