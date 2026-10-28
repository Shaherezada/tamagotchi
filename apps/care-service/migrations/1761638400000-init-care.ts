import type { MigrationInterface, QueryRunner } from 'typeorm';

const CARE_TYPES = "('FEED', 'SNACK', 'PLAY', 'CLEAN', 'HEAL', 'SCOLD', 'LIGHTS_OFF', 'LIGHTS_ON')";

/** care_db (§7): каталог, кошельки и журнал, инвентарь, покупки, действия ухода, inbox. */
export class InitCare1761638400000 implements MigrationInterface {
  name = 'InitCare1761638400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE items (
        id              UUID         NOT NULL DEFAULT gen_random_uuid(),
        code            VARCHAR(32)  NOT NULL,
        title           VARCHAR(64)  NOT NULL,
        description     VARCHAR(256) NOT NULL,
        category        VARCHAR(10)  NOT NULL,
        price           INTEGER      NOT NULL,
        is_consumable   BOOLEAN      NOT NULL,
        hunger_delta    SMALLINT     NOT NULL DEFAULT 0,
        happiness_delta SMALLINT     NOT NULL DEFAULT 0,
        weight_delta    SMALLINT     NOT NULL DEFAULT 0,
        cures_sickness  BOOLEAN      NOT NULL DEFAULT false,
        icon_key        VARCHAR(128) NULL,
        is_active       BOOLEAN      NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT pk_items PRIMARY KEY (id),
        CONSTRAINT uq_items_code UNIQUE (code),
        CONSTRAINT chk_items_category CHECK (category IN ('FOOD', 'SNACK', 'MEDICINE', 'TOY')),
        CONSTRAINT chk_items_price CHECK (price >= 0)
      )`);
    await queryRunner.query(`
      CREATE TABLE wallets (
        user_id    UUID        NOT NULL,
        balance    INTEGER     NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_wallets PRIMARY KEY (user_id),
        CONSTRAINT chk_wallets_balance CHECK (balance >= 0)
      )`);
    await queryRunner.query(`
      CREATE TABLE wallet_transactions (
        id            BIGSERIAL   NOT NULL,
        user_id       UUID        NOT NULL,
        amount        INTEGER     NOT NULL,
        balance_after INTEGER     NOT NULL,
        reason        VARCHAR(20) NOT NULL,
        reference_id  UUID        NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_wallet_transactions PRIMARY KEY (id),
        CONSTRAINT fk_wallet_transactions_wallet FOREIGN KEY (user_id) REFERENCES wallets (user_id),
        CONSTRAINT chk_wallet_transactions_amount CHECK (amount <> 0),
        CONSTRAINT chk_wallet_transactions_balance_after CHECK (balance_after >= 0),
        CONSTRAINT chk_wallet_transactions_reason
          CHECK (reason IN ('STARTER_KIT', 'PURCHASE', 'PLAY_REWARD', 'EVOLUTION_REWARD'))
      )`);
    await queryRunner.query('CREATE INDEX ix_wallet_transactions_user_id ON wallet_transactions (user_id, created_at)');
    await queryRunner.query(`
      CREATE TABLE inventory_items (
        user_id    UUID        NOT NULL,
        item_id    UUID        NOT NULL,
        quantity   INTEGER     NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_inventory_items PRIMARY KEY (user_id, item_id),
        CONSTRAINT fk_inventory_items_item FOREIGN KEY (item_id) REFERENCES items (id),
        CONSTRAINT chk_inventory_items_quantity CHECK (quantity >= 0)
      )`);
    await queryRunner.query(`
      CREATE TABLE purchases (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        user_id     UUID        NOT NULL,
        item_id     UUID        NOT NULL,
        quantity    SMALLINT    NOT NULL,
        unit_price  INTEGER     NOT NULL,
        total_price INTEGER     NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_purchases PRIMARY KEY (id),
        CONSTRAINT fk_purchases_item FOREIGN KEY (item_id) REFERENCES items (id),
        CONSTRAINT chk_purchases_quantity CHECK (quantity > 0),
        CONSTRAINT chk_purchases_unit_price CHECK (unit_price >= 0),
        CONSTRAINT chk_purchases_total_price CHECK (total_price = unit_price * quantity)
      )`);
    await queryRunner.query('CREATE INDEX ix_purchases_user_id ON purchases (user_id)');
    await queryRunner.query(`
      CREATE TABLE care_actions (
        id            UUID        NOT NULL DEFAULT gen_random_uuid(),
        user_id       UUID        NOT NULL,
        pet_id        UUID        NOT NULL,
        type          VARCHAR(12) NOT NULL,
        item_id       UUID        NULL,
        status        VARCHAR(10) NOT NULL DEFAULT 'PENDING',
        attempts      SMALLINT    NOT NULL DEFAULT 0,
        result        JSONB       NULL,
        reject_reason VARCHAR(32) NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at  TIMESTAMPTZ NULL,
        CONSTRAINT pk_care_actions PRIMARY KEY (id),
        CONSTRAINT fk_care_actions_item FOREIGN KEY (item_id) REFERENCES items (id),
        CONSTRAINT chk_care_actions_type CHECK (type IN ${CARE_TYPES}),
        CONSTRAINT chk_care_actions_status CHECK (status IN ('PENDING', 'APPLIED', 'REJECTED')),
        CONSTRAINT chk_care_actions_attempts CHECK (attempts >= 0)
      )`);
    await queryRunner.query('CREATE INDEX ix_care_actions_user_id ON care_actions (user_id, created_at)');
    await queryRunner.query('CREATE INDEX ix_care_actions_pet_id ON care_actions (pet_id)');
    // досылка выбирает только зависшие действия
    await queryRunner.query(
      "CREATE INDEX ix_care_actions_pending ON care_actions (created_at) WHERE status = 'PENDING'",
    );
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
    await queryRunner.query('DROP TABLE care_actions');
    await queryRunner.query('DROP TABLE purchases');
    await queryRunner.query('DROP TABLE inventory_items');
    await queryRunner.query('DROP TABLE wallet_transactions');
    await queryRunner.query('DROP TABLE wallets');
    await queryRunner.query('DROP TABLE items');
  }
}
