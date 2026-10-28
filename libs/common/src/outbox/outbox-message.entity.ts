import type { EventEnvelope } from '@app/contracts';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Событие, ждущее публикации (transactional outbox, §6); id = eventId конверта. */
@Entity('outbox_messages')
export class OutboxMessage {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'routing_key', type: 'varchar', length: 64 })
  routingKey: string;

  @Column({ type: 'jsonb' })
  payload: EventEnvelope<object>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'varchar', length: 512, nullable: true })
  lastError: string | null;
}
