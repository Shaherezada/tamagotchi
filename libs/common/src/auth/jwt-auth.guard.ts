import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ProblemException } from '../errors/problem.exception';
import type { HttpRequest } from '../http/http-request';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { isJwtUser, JwtUser } from './jwt-user';
import { TokenRevocationService } from './token-revocation.service';

/**
 * Проверка Bearer JWT (RS256, открытый ключ из JWT_PUBLIC_KEY_FILE) на каждом HTTP-запросе,
 * кроме методов с @Public(). Отозванный токен (auth:revoked:<jti> в Redis) – 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly revocation: TokenRevocationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ProblemException.unauthorized('Нужен заголовок Authorization: Bearer <JWT>');
    }
    const user = await this.verify(token);
    if (await this.revocation.isRevoked(user.jti)) {
      throw ProblemException.unauthorized('Токен отозван');
    }
    request.user = user;
    return true;
  }

  private async verify(token: string): Promise<JwtUser> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<object>(token, { algorithms: ['RS256'] });
    } catch {
      throw ProblemException.unauthorized('Токен недействителен или истёк');
    }
    if (!isJwtUser(payload)) {
      throw ProblemException.unauthorized('В токене нет нужных полей');
    }
    const { sub, role, jti, exp } = payload;
    return { sub, role, jti, exp };
  }
}
