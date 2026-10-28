import type { MigrationInterface, QueryRunner } from 'typeorm';

/** notifications_db (§7): уведомления, настройки, inbox. */
export class InitNotifications1761638400000 implements MigrationInterface {
  name = 'InitNotifications1761638400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id         UUID         NOT NULL DEFAULT gen_random_uuid(),
        user_id    UUID         NOT NULL,
        type       VARCHAR(16)  NOT NULL,
        title      VARCHAR(96)  NOT NULL,
        body       VARCHAR(512) NOT NULL,
        pet_id     UUID         NULL,
        is_read    BOOLEAN      NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
        read_at    TIMESTAMPTZ  NULL,
        CONSTRAINT pk_notifications PRIMARY KEY (id),
        CONSTRAINT chk_notifications_type
          CHECK (type IN ('WELCOME', 'PET_HUNGRY', 'PET_SICK', 'PET_EVOLVED', 'PET_DIED'))
      )`);
    // курсорная пагинация: игрок, затем (created_at, id) от новых к старым
    await queryRunner.query(
      'CREATE INDEX ix_notifications_user_id ON notifications (user_id, created_at DESC, id DESC)',
    );
    await queryRunner.query(`
      CREATE TABLE notification_settings (
        user_id     UUID        NOT NULL,
        pet_hungry  BOOLEAN     NOT NULL DEFAULT true,
        pet_sick    BOOLEAN     NOT NULL DEFAULT true,
        pet_evolved BOOLEAN     NOT NULL DEFAULT true,
        pet_died    BOOLEAN     NOT NULL DEFAULT true,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_notification_settings PRIMARY KEY (user_id)
      )`);
    await queryRunner.query(`
      CREATE TABLE processed_events (
        event_id     UUID        NOT NULL,
        routing_key  VARCHAR(64) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_processed_events PRIMARY KEY (event_id)
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE processed_events');
    await queryRunner.query('DROP TABLE notification_settings');
    await queryRunner.query('DROP TABLE notifications');
  }
}
