import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { HttpRequest } from '../http/http-request';
import { getRequestId } from '../request-id/request-id.middleware';
import { ProblemDetails } from './problem-details';
import { ProblemException } from './problem.exception';
import { PROBLEM_CONTENT_TYPE, defaultProblem, problemType } from './problem-types';

/**
 * Любая ошибка HTTP-запроса превращается в problem+json (§10). Тексты чужих исключений и stack trace
 * клиенту не уходят: подробности 5xx – только в лог вместе с requestId.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }
    const http = host.switchToHttp();
    const req = http.getRequest<HttpRequest>();
    const res = http.getResponse<Response>();

    const problem = this.toProblem(exception);
    problem.instance = (req.originalUrl ?? req.url ?? '').split('?')[0];
    problem.requestId = getRequestId(req);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR && problem.status !== HttpStatus.NOT_IMPLEMENTED) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`requestId=${problem.requestId} ${req.method} ${problem.instance}`, stack);
    }
    // поток SSE уже начат – ответить ошибкой нельзя
    if (res.headersSent) {
      return;
    }
    res.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof ProblemException) {
      return { ...exception.problem };
    }
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const fallback = defaultProblem(status);
    return {
      type: problemType(fallback.type),
      title: fallback.title,
      status,
      instance: '',
      requestId: '',
    };
  }
}
