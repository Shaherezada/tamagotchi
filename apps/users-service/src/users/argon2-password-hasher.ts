import { Injectable, NotImplementedException } from '@nestjs/common';
import { PasswordHasher } from './password-hasher';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(_password: string): Promise<string> {
    throw new NotImplementedException();
  }

  verify(_hash: string, _password: string): Promise<boolean> {
    throw new NotImplementedException();
  }
}
