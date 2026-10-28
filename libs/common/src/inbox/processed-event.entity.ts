import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Отметка обработанного события (idempotent consumer, §6). */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'routing_key', type: 'varchar', length: 64 })
  routingKey: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
