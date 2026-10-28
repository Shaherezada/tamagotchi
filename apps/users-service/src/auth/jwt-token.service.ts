import { Injectable, NotImplementedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../users/user.entity';
import { AuthTokenDto } from './dto/auth-token.dto';

/** Срок жизни токена (§11). */
export const TOKEN_TTL_SECONDS = 60 * 60;

/** Выпуск JWT RS256 с полями sub, role, jti, exp. */
@Injectable()
export class JwtTokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(_user: User): AuthTokenDto {
    throw new NotImplementedException();
  }
}
