import { type JwtUser, type OutboxService, ProblemException, Role, type TokenRevocationService } from '@app/common';
import type { EventEnvelope, UserRegistered } from '@app/contracts';
import { type DataSource, type EntityManager, QueryFailedError, type Repository } from 'typeorm';
import type { PasswordHasher } from '../users/password-hasher';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import type { JwtTokenService } from './jwt-token.service';

const createdAt = new Date('2026-11-05T10:15:00Z');

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    login: 'masha',
    nickname: 'Маша',
    passwordHash: 'hash:secret123',
    role: Role.PLAYER,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

function setup() {
  const users = { existsBy: jest.fn().mockResolvedValue(false), findOneBy: jest.fn().mockResolvedValue(null) };
  const manager = {
    create: jest.fn((_entity: unknown, data: Partial<User>) => Object.assign(new User(), data)),
    save: jest.fn(async (user: User) => Object.assign(user, { id: makeUser().id, role: Role.PLAYER, createdAt })),
  };
  const outbox = { add: jest.fn().mockResolvedValue(undefined) };
  const dataSource = {
    transaction: jest.fn(<T>(work: (m: EntityManager) => Promise<T>) => work(manager as unknown as EntityManager)),
  };
  const tokens = {
    issue: jest.fn((user: User) => ({ userId: user.id, accessToken: `token-${user.id}`, expiresIn: 3600 })),
  };
  const revocation = { revoke: jest.fn().mockResolvedValue(undefined) };
  const hasher = {
    hash: jest.fn(async (password: string) => `hash:${password}`),
    verify: jest.fn(async (hash: string, password: string) => hash === `hash:${password}`),
  };
  const service = new AuthService(
    users as unknown as Repository<User>,
    outbox as unknown as OutboxService,
    dataSource as unknown as DataSource,
    tokens as unknown as JwtTokenService,
    revocation as unknown as TokenRevocationService,
    hasher as unknown as PasswordHasher,
  );
  return { service, users, manager, outbox, dataSource, tokens, revocation, hasher };
}

async function problemOf(promise: Promise<unknown>): Promise<ProblemException> {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProblemException);
  return error as ProblemException;
}

describe('AuthService', () => {
  describe('register', () => {
    const dto = { login: 'masha', nickname: 'Маша', password: 'secret123' };

    it('создаёт игрока с хэшем пароля и кладёт user.registered в outbox той же транзакцией', async () => {
      const { service, manager, outbox, dataSource, tokens } = setup();

      const result = await service.register(dto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      const saved = manager.save.mock.calls[0][0];
      expect(saved).toMatchObject({ login: 'masha', nickname: 'Маша', passwordHash: 'hash:secret123' });
      expect(outbox.add).toHaveBeenCalledWith(manager, expect.anything());
      const envelope = outbox.add.mock.calls[0][1] as EventEnvelope<UserRegistered>;
      expect(envelope).toMatchObject({ type: 'user.registered', version: 1, occurredAt: createdAt.toISOString() });
      expect(envelope.payload).toEqual({
        userId: makeUser().id,
        login: 'masha',
        nickname: 'Маша',
        registeredAt: createdAt.toISOString(),
      });
      expect(tokens.issue).toHaveBeenCalledWith(saved);
      expect(result).toEqual({ userId: makeUser().id, accessToken: `token-${makeUser().id}`, expiresIn: 3600 });
    });

    it('занятый логин – 409 login-taken, транзакция не начинается', async () => {
      const { service, users, dataSource } = setup();
      users.existsBy.mockResolvedValue(true);

      const problem = await problemOf(service.register(dto));

      expect(problem.problem).toMatchObject({ status: 409, type: expect.stringMatching(/\/login-taken$/) });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('гонка двух регистраций: нарушение UNIQUE превращается в 409, а не 500', async () => {
      const { service, manager, tokens } = setup();
      const unique = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505' }));
      manager.save.mockRejectedValue(unique);

      const problem = await problemOf(service.register(dto));

      expect(problem.problem.status).toBe(409);
      expect(tokens.issue).not.toHaveBeenCalled();
    });

    it('другая ошибка БД пробрасывается как есть', async () => {
      const { service, manager } = setup();
      manager.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.register(dto)).rejects.toThrow('connection lost');
    });
  });

  describe('login', () => {
    it('верный логин и пароль – выдаёт токен', async () => {
      const { service, users, tokens } = setup();
      const user = makeUser();
      users.findOneBy.mockResolvedValue(user);

      const result = await service.login({ login: 'masha', password: 'secret123' });

      expect(users.findOneBy).toHaveBeenCalledWith({ login: 'masha' });
      expect(tokens.issue).toHaveBeenCalledWith(user);
      expect(result.userId).toBe(user.id);
    });

    it('неверный пароль – 401 invalid-credentials', async () => {
      const { service, users, tokens } = setup();
      users.findOneBy.mockResolvedValue(makeUser());

      const problem = await problemOf(service.login({ login: 'masha', password: 'wrong1234' }));

      expect(problem.problem).toMatchObject({ status: 401, type: expect.stringMatching(/\/invalid-credentials$/) });
      expect(tokens.issue).not.toHaveBeenCalled();
    });

    it('неизвестный логин – тот же 401, пароль всё равно проверяется (против подставного хэша)', async () => {
      const { service, hasher } = setup();

      const problem = await problemOf(service.login({ login: 'ghost', password: 'secret123' }));

      expect(problem.problem).toMatchObject({ status: 401, title: 'Неверный логин или пароль' });
      expect(hasher.verify).toHaveBeenCalledWith(expect.stringMatching(/^\$argon2id\$/), 'secret123');
    });
  });

  describe('logout', () => {
    it('отзывает токен по jti', async () => {
      const { service, revocation } = setup();
      const user: JwtUser = { sub: makeUser().id, role: Role.PLAYER, jti: 'jti-1', exp: 2_000_000_000 };

      await service.logout(user);

      expect(revocation.revoke).toHaveBeenCalledWith(user);
    });
  });
});
