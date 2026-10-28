import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProblemException } from '../errors/problem.exception';
import type { HttpRequest } from '../http/http-request';
import { ROLES_KEY } from './auth.decorators';
import { Role } from './role.enum';

/** Проверка @Roles(); срабатывает после JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length || context.getType() !== 'http') {
      return true;
    }
    const user = context.switchToHttp().getRequest<HttpRequest>().user;
    if (!user) {
      throw ProblemException.unauthorized();
    }
    if (!roles.includes(user.role)) {
      throw ProblemException.forbidden(`Метод доступен роли: ${roles.join(', ')}`);
    }
    return true;
  }
}
