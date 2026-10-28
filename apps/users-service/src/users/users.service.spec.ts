import { ProblemException, Role } from '@app/common';
import type { Repository } from 'typeorm';
import type { PasswordHasher } from './password-hasher';
import { User } from './user.entity';
import { UsersService } from './users.service';

const createdAt = new Date('2026-11-05T10:15:00Z');
const userId = 'a1b2c3d4-0000-4000-8000-000000000001';

function makeUser(): User {
  return Object.assign(new User(), {
    id: userId,
    login: 'masha',
    nickname: 'Маша',
    passwordHash: 'hash:secret123',
    role: Role.PLAYER,
    createdAt,
    updatedAt: createdAt,
  });
}

function setup(user: User | null = makeUser()) {
  const users = {
    findOneBy: jest.fn().mockResolvedValue(user),
    save: jest.fn(async (u: User) => u),
  };
  const hasher = {
    hash: jest.fn(async (password: string) => `hash:${password}`),
    verify: jest.fn(async (hash: string, password: string) => hash === `hash:${password}`),
  };
  const service = new UsersService(users as unknown as Repository<User>, hasher as unknown as PasswordHasher);
  return { service, users, hasher };
}

async function problemOf(promise: Promise<unknown>): Promise<ProblemException> {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProblemException);
  return error as ProblemException;
}

describe('UsersService', () => {
  describe('getMe', () => {
    it('отдаёт профиль без хэша пароля', async () => {
      const { service, users } = setup();

      const dto = await service.getMe(userId);

      expect(users.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(dto).toEqual({ id: userId, login: 'masha', nickname: 'Маша', role: Role.PLAYER, createdAt });
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('пользователя из токена нет в БД – 401', async () => {
      const { service } = setup(null);

      expect((await problemOf(service.getMe(userId))).problem.status).toBe(401);
    });
  });

  describe('updateMe', () => {
    it('меняет ник и сохраняет', async () => {
      const { service, users } = setup();

      const dto = await service.updateMe(userId, { nickname: 'Мария' });

      expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ id: userId, nickname: 'Мария' }));
      expect(dto.nickname).toBe('Мария');
    });

    it('пользователя нет – 401, ничего не сохраняется', async () => {
      const { service, users } = setup(null);

      expect((await problemOf(service.updateMe(userId, { nickname: 'Мария' }))).problem.status).toBe(401);
      expect(users.save).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('верный текущий пароль – сохраняет хэш нового', async () => {
      const { service, users } = setup();

      await service.changePassword(userId, { currentPassword: 'secret123', newPassword: 'newSecret456' });

      expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: 'hash:newSecret456' }));
    });

    it('неверный текущий пароль – 401 invalid-password, пароль не меняется', async () => {
      const { service, users, hasher } = setup();

      const problem = await problemOf(
        service.changePassword(userId, { currentPassword: 'wrong1234', newPassword: 'newSecret456' }),
      );

      expect(problem.problem).toMatchObject({ status: 401, type: expect.stringMatching(/\/invalid-password$/) });
      expect(hasher.hash).not.toHaveBeenCalled();
      expect(users.save).not.toHaveBeenCalled();
    });
  });
});
