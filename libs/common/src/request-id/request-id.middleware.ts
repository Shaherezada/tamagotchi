import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { HttpRequest } from '../http/http-request';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// чужой заголовок попадает в логи и ответ, поэтому принимается только короткий и без спецсимволов
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/** Берёт X-Request-Id из запроса (его ставит nginx) или создаёт новый и возвращает в ответе. */
export function requestIdMiddleware(req: HttpRequest, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(req: HttpRequest): string {
  return req.requestId ?? '';
}
