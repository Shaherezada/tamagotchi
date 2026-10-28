import { HttpException, HttpStatus } from '@nestjs/common';
import { FieldError, ProblemDetails } from './problem-details';
import { defaultProblem, problemType } from './problem-types';

export interface ProblemInit {
  status: number;
  /** Последняя часть URI типа ошибки, например insufficient-funds; по умолчанию – по коду ответа. */
  type?: string;
  title?: string;
  detail?: string;
  errors?: FieldError[];
}

/** Исключение с готовым описанием ошибки; instance и requestId заполняет ProblemDetailsFilter. */
export class ProblemException extends HttpException {
  readonly problem: ProblemDetails;

  constructor(init: ProblemInit) {
    const fallback = defaultProblem(init.status);
    const problem: ProblemDetails = {
      type: problemType(init.type ?? fallback.type),
      title: init.title ?? fallback.title,
      status: init.status,
      detail: init.detail,
      instance: '',
      requestId: '',
      errors: init.errors,
    };
    super(problem, init.status);
    this.problem = problem;
  }

  static badRequest(title?: string, detail?: string, type?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.BAD_REQUEST, title, detail, type });
  }

  static unauthorized(detail?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.UNAUTHORIZED, detail });
  }

  static forbidden(detail?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.FORBIDDEN, detail });
  }

  static notFound(title?: string, detail?: string, type?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.NOT_FOUND, title, detail, type });
  }

  static conflict(type: string, title: string, detail?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.CONFLICT, type, title, detail });
  }

  static serviceUnavailable(detail?: string): ProblemException {
    return new ProblemException({ status: HttpStatus.SERVICE_UNAVAILABLE, detail });
  }
}
