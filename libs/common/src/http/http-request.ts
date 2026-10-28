import type { Request } from 'express';
import type { JwtUser } from '../auth/jwt-user';

/** Запрос Express с полями, которые добавляют request-id и JwtAuthGuard. */
export interface HttpRequest extends Request {
  requestId?: string;
  user?: JwtUser;
}
