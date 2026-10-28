import { randomUUID } from 'node:crypto';
import { type DataSource, type EntityManager, FindOperator, type Repository } from 'typeorm';

type Row = Record<string, unknown>;
type EntityClass = abstract new (...args: never[]) => object;

/**
 * Имитация PostgreSQL для unit-тестов care-service: таблица – массив строк, findOne возвращает саму строку.
 * Поддержано ровно то, чем пользуются сервисы: findOne/find/save, INSERT ... ON CONFLICT DO NOTHING,
 * inbox-запрос в processed_events и откат транзакции при ошибке. Блокировки не нужны – тесты однопоточные.
 */
export class InMemoryDb {
  private tables = new Map<EntityClass, Row[]>();
  private processed = new Set<string>();

  /** Первичные ключи, отличные от id. */
  constructor(private readonly keys: Map<EntityClass, string[]> = new Map()) {}

  rows<T>(entity: abstract new (...args: never[]) => T): T[] {
    return this.table(entity) as T[];
  }

  insert<T>(entity: abstract new (...args: never[]) => T, row: Partial<T>): T {
    return this.save(entity as EntityClass, row as Row) as T;
  }

  readonly manager = {
    findOne: async (entity: EntityClass, options: { where: Row }) => this.find(entity, options)[0] ?? null,
    find: async (entity: EntityClass, options: { where?: Row; order?: Record<string, unknown>; take?: number }) =>
      this.find(entity, options),
    save: async (entity: EntityClass, row: Row) => this.save(entity, row),
    query: async (sql: string, [eventId]: [string]) => {
      if (!sql.includes('processed_events')) throw new Error(`Не поддержано: ${sql}`);
      if (this.processed.has(eventId)) return [];
      this.processed.add(eventId);
      return [{ event_id: eventId }];
    },
    createQueryBuilder: () => {
      let entity: EntityClass;
      let values: Row;
      const builder = {
        insert: () => builder,
        into: (target: EntityClass) => ((entity = target), builder),
        values: (row: Row) => ((values = row), builder),
        orIgnore: () => builder,
        execute: async () => {
          if (!this.byKey(entity, values)) this.save(entity, values);
        },
      };
      return builder;
    },
    getRepository: (entity: EntityClass) => this.repository(entity),
  } as unknown as EntityManager;

  readonly dataSource = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const tables = new Map([...this.tables].map(([entity, rows]) => [entity, rows.map((row) => ({ ...row }))]));
      const processed = new Set(this.processed);
      try {
        return await work(this.manager);
      } catch (error) {
        // откат: строки восстанавливаются копиями, как после ROLLBACK
        this.tables = tables;
        this.processed = processed;
        throw error;
      }
    },
    getRepository: (entity: EntityClass) => this.repository(entity),
  } as unknown as DataSource;

  repository<T>(entity: abstract new (...args: never[]) => T): Repository<T> {
    return {
      findOne: async (options: { where: Row }) => this.find(entity as EntityClass, options)[0] ?? null,
      find: async (options: { where?: Row; order?: Record<string, unknown>; take?: number }) =>
        this.find(entity as EntityClass, options),
    } as unknown as Repository<T>;
  }

  private table(entity: EntityClass): Row[] {
    if (!this.tables.has(entity)) this.tables.set(entity, []);
    return this.tables.get(entity)!;
  }

  private keyOf(entity: EntityClass): string[] {
    return this.keys.get(entity) ?? ['id'];
  }

  private byKey(entity: EntityClass, row: Row): Row | undefined {
    const keys = this.keyOf(entity);
    return this.table(entity).find((r) => keys.every((k) => row[k] !== undefined && r[k] === row[k]));
  }

  private save(entity: EntityClass, row: Row): Row {
    const existing = this.byKey(entity, row);
    if (existing) {
      return Object.assign(existing, row);
    }
    const stored: Row = { ...row };
    if (this.keyOf(entity).includes('id') && stored.id === undefined) stored.id = randomUUID();
    stored.createdAt ??= new Date();
    this.table(entity).push(stored);
    return stored;
  }

  private find(entity: EntityClass, options: { where?: Row; order?: Record<string, unknown>; take?: number }): Row[] {
    let rows = this.table(entity).filter((row) => matches(row, options.where ?? {}));
    const order = Object.entries(options.order ?? {}).filter(([, dir]) => typeof dir === 'string');
    if (order.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const [field, dir] of order) {
          const diff = compare(a[field], b[field]);
          if (diff !== 0) return dir === 'DESC' ? -diff : diff;
        }
        return 0;
      });
    }
    return options.take ? rows.slice(0, options.take) : rows;
  }
}

function compare(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : (a as number);
  const y = b instanceof Date ? b.getTime() : (b as number);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([field, expected]) => {
    const actual = row[field];
    if (expected instanceof FindOperator) {
      const value = expected.value as unknown;
      switch (expected.type) {
        case 'lessThan':
          return compare(actual, value) < 0;
        case 'moreThan':
          return compare(actual, value) > 0;
        case 'in':
          return (value as unknown[]).includes(actual);
        default:
          throw new Error(`Оператор ${expected.type} не поддержан`);
      }
    }
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      return !!actual && typeof actual === 'object' && matches(actual as Row, expected as Row);
    }
    return actual === expected;
  });
}
