import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { PasswordHasher } from './password-hasher';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      // испорченный хэш в БД – не повод для 500, просто пароль не подходит
      return false;
    }
  }
}
