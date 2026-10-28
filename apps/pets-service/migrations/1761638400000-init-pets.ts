import type { MigrationInterface, QueryRunner } from 'typeorm';

const STAGES = "('EGG', 'BABY', 'CHILD', 'TEEN', 'ADULT', 'ELDER')";
const CARE_TYPES = "('FEED', 'SNACK', 'PLAY', 'CLEAN', 'HEAL', 'SCOLD', 'LIGHTS_OFF', 'LIGHTS_ON')";

/** pets_db (§7): питомцы, справочник форм, хронология, применённый уход, outbox. */
export class InitPets1761638400000 implements MigrationInterface {
  name = 'InitPets1761638400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pet_forms (
        code        VARCHAR(32)  NOT NULL,
        stage       VARCHAR(8)   NOT NULL,
        title       VARCHAR(32)  NOT NULL,
        description VARCHAR(256) NOT NULL,
        image_key   VARCHAR(128) NOT NULL,
        CONSTRAINT pk_pet_forms PRIMARY KEY (code),
        CONSTRAINT chk_pet_forms_stage CHECK (stage IN ${STAGES})
      )`);
    await queryRunner.query(`
      CREATE TABLE pets (
        id              UUID        NOT NULL DEFAULT gen_random_uuid(),
        owner_id        UUID        NOT NULL,
        name            VARCHAR(24) NOT NULL,
        stage           VARCHAR(8)  NOT NULL,
        form_code       VARCHAR(32) NOT NULL,
        hunger          SMALLINT    NOT NULL,
        happiness       SMALLINT    NOT NULL,
        discipline      SMALLINT    NOT NULL,
        weight          SMALLINT    NOT NULL,
        poop_count      SMALLINT    NOT NULL DEFAULT 0,
        is_sick         BOOLEAN     NOT NULL DEFAULT false,
        is_sleeping     BOOLEAN     NOT NULL DEFAULT false,
        attention       VARCHAR(12) NULL,
        attention_since TIMESTAMPTZ NULL,
        mistake_counted BOOLEAN     NOT NULL DEFAULT false,
        care_mistakes   SMALLINT    NOT NULL DEFAULT 0,
        starving_since  TIMESTAMPTZ NULL,
        born_at         TIMESTAMPTZ NOT NULL,
        stage_since     TIMESTAMPTZ NOT NULL,
        simulated_at    TIMESTAMPTZ NOT NULL,
        next_tick_at    TIMESTAMPTZ NOT NULL,
        died_at         TIMESTAMPTZ NULL,
        death_cause     VARCHAR(10) NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_pets PRIMARY KEY (id),
        CONSTRAINT fk_pets_form FOREIGN KEY (form_code) REFERENCES pet_forms (code),
        CONSTRAINT chk_pets_stage CHECK (stage IN ${STAGES}),
        CONSTRAINT chk_pets_hunger CHECK (hunger BETWEEN 0 AND 4),
        CONSTRAINT chk_pets_happiness CHECK (happiness BETWEEN 0 AND 4),
        CONSTRAINT chk_pets_discipline CHECK (discipline BETWEEN 0 AND 100),
        CONSTRAINT chk_pets_weight CHECK (weight >= 1),
        CONSTRAINT chk_pets_poop_count CHECK (poop_count BETWEEN 0 AND 4),
        CONSTRAINT chk_pets_attention CHECK (attention IN ('HUNGRY', 'UNHAPPY', 'DIRTY', 'SICK', 'MISBEHAVING')),
        CONSTRAINT chk_pets_care_mistakes CHECK (care_mistakes >= 0),
        CONSTRAINT chk_pets_death_cause CHECK (death_cause IN ('NEGLECT', 'OLD_AGE')),
        CONSTRAINT chk_pets_death CHECK ((died_at IS NULL) = (death_cause IS NULL))
      )`);
    await queryRunner.query('CREATE INDEX ix_pets_owner_id ON pets (owner_id)');
    // планировщик выбирает только живых питомцев с подошедшим тиком
    await queryRunner.query('CREATE INDEX ix_pets_next_tick_at ON pets (next_tick_at) WHERE died_at IS NULL');
    await queryRunner.query(`
      CREATE TABLE pet_events (
        id          BIGSERIAL   NOT NULL,
        pet_id      UUID        NOT NULL,
        type        VARCHAR(16) NOT NULL,
        details     JSONB       NOT NULL DEFAULT '{}',
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_pet_events PRIMARY KEY (id),
        CONSTRAINT fk_pet_events_pet FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE
      )`);
    await queryRunner.query('CREATE INDEX ix_pet_events_pet_id ON pet_events (pet_id, occurred_at)');
    await queryRunner.query(`
      CREATE TABLE applied_care_actions (
        action_id  UUID        NOT NULL,
        pet_id     UUID        NOT NULL,
        type       VARCHAR(12) NOT NULL,
        result     JSONB       NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT pk_applied_care_actions PRIMARY KEY (action_id),
        CONSTRAINT fk_applied_care_actions_pet FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE,
        CONSTRAINT chk_applied_care_actions_type CHECK (type IN ${CARE_TYPES})
      )`);
    await queryRunner.query('CREATE INDEX ix_applied_care_actions_pet_id ON applied_care_actions (pet_id)');
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
    await queryRunner.query('DROP TABLE applied_care_actions');
    await queryRunner.query('DROP TABLE pet_events');
    await queryRunner.query('DROP TABLE pets');
    await queryRunner.query('DROP TABLE pet_forms');
  }
}
