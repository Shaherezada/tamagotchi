import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { FieldError, ProblemDetails } from '../errors/problem-details';
import { PROBLEM_CONTENT_TYPE } from '../errors/problem-types';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Ошибка валидации: неверные поля перечислены в errors[]',
  401: 'Нет токена, токен недействителен, истёк или отозван',
  403: 'Недостаточно прав для этой роли',
  404: 'Объект не найден или принадлежит другому игроку',
  409: 'Конфликт с текущим состоянием',
  413: 'Файл больше допустимого размера',
  415: 'Неподдерживаемый тип файла',
  500: 'Внутренняя ошибка сервера',
  503: 'Зависимый сервис временно недоступен',
};

/** Код ответа или пара «код, описание», если стандартного описания мало. */
export type ProblemResponse = number | [number, string];

/**
 * Ответы-ошибки метода одной строкой: `@ApiProblems(400, 401, [409, 'Логин занят'])`.
 * Схема каждого – ProblemDetails с Content-Type application/problem+json.
 */
export function ApiProblems(...responses: ProblemResponse[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ProblemDetails, FieldError),
    ...responses.map((response) => {
      const [status, description] = Array.isArray(response) ? response : [response, DESCRIPTIONS[response]];
      return ApiResponse({
        status,
        description: description ?? 'Ошибка',
        content: { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: getSchemaPath(ProblemDetails) } } },
      });
    }),
  );
}
