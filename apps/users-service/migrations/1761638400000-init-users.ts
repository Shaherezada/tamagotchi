import type { MigrationInterface, QueryRunner } from 'typeorm';

/** users_db (§7): пользователи и outbox. */
export class InitUsers1761638400000 implements MigrationInterface {
  name = 'InitUsers1761638400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID         NOT NULL DEFAULT gen_random_uuid(),
        login         VARCHAR(32)  NOT NULL,
        nickname      VARCHAR(32)  NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(10)  NOT NULL DEFAULT 'player',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT uq_users_login UNIQUE (login),
        CONSTRAINT chk_users_role CHECK (role IN ('player', 'admin'))
      )`);
    await queryRunner.query(`
      CREATE TABLE outbox_messages (
        id           UUID         NOT NULL,
        routing_key  VARCHAR(64)  NOT NULL,
        payload      JSONB        NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        published_at TIMESTAMPTZ  NULL,
        attempts     INTEGER      NOT NULL DEFAULT 0,
        last_error   VARCHAR(512) NULL,
        CONSTRAINT pk_outbox_messages PRIMARY KEY (id),
        CONSTRAINT chk_outbox_messages_attempts CHECK (attempts >= 0)
      )`);
    await queryRunner.query(
      'CREATE INDEX ix_outbox_messages_unpublished ON outbox_messages (created_at) WHERE published_at IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE outbox_messages');
    await queryRunner.query('DROP TABLE users');
  }
}
