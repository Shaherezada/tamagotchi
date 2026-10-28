import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export const LOGIN_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
// 8–64 символа, хотя бы одна буква и одна цифра (§11)
export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).{8,64}$/u;

export function IsLogin(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(LOGIN_PATTERN, { message: 'login: 3–32 символа, латинские буквы, цифры и _' }),
  );
}

export function IsNickname(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    Length(1, 32),
  );
}

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(PASSWORD_PATTERN, { message: 'пароль: 8–64 символа, хотя бы одна буква и одна цифра' }),
  );
}
