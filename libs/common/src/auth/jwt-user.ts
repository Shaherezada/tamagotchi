import { Role } from './role.enum';

/** Поля JWT (§11): sub – id игрока, jti – id токена для отзыва, exp – время истечения в секундах. */
export interface JwtUser {
  sub: string;
  role: Role;
  jti: string;
  exp: number;
}

export function isJwtUser(value: unknown): value is JwtUser {
  const v = value as Partial<JwtUser> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.sub === 'string' &&
    typeof v.jti === 'string' &&
    typeof v.exp === 'number' &&
    Object.values(Role).includes(v.role as Role)
  );
}
