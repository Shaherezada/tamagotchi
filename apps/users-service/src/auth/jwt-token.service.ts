import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../users/user.entity';
import { AuthTokenDto } from './dto/auth-token.dto';

/** Срок жизни токена (§11). */
export const TOKEN_TTL_SECONDS = 60 * 60;

/** Выпуск JWT RS256 с полями sub, role, jti, exp. */
@Injectable()
export class JwtTokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(user: User): AuthTokenDto {
    // exp и алгоритм RS256 – из signOptions в AuthModule; jti нужен для отзыва при выходе
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role }, { jwtid: randomUUID() });
    return { userId: user.id, accessToken, expiresIn: TOKEN_TTL_SECONDS };
  }
}
