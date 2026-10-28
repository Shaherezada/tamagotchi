import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldError } from './problem-details';
import { ProblemException } from './problem.exception';

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function validationException(errors: ValidationError[]): ProblemException {
  return new ProblemException({
    status: HttpStatus.BAD_REQUEST,
    type: 'validation-error',
    title: 'Ошибка валидации',
    detail: 'Запрос содержит неверные поля',
    errors: flattenValidationErrors(errors),
  });
}

/** Глобальный ValidationPipe по §11: лишние поля – ошибка, входные данные приводятся к DTO. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationException,
  });
}
