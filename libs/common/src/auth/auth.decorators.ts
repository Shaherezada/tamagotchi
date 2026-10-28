import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { HttpRequest } from '../http/http-request';
import type { JwtUser } from './jwt-user';
import { Role } from './role.enum';

export const IS_PUBLIC_KEY = 'tamagotchi:public';
export const ROLES_KEY = 'tamagotchi:roles';

/** Метод доступен без токена (вход, регистрация, каталог). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Метод доступен только этим ролям; проверяет RolesGuard. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

/** Текущий пользователь из проверенного JWT. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
  return ctx.switchToHttp().getRequest<HttpRequest>().user;
});
