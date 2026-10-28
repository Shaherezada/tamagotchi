/** Хэш пароля; абстрактный класс – он же токен внедрения (реализация – Argon2PasswordHasher). */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(hash: string, password: string): Promise<boolean>;
}
