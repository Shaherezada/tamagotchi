export const PROBLEM_TYPE_BASE = 'https://tamagotchi.local/problems/';
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Тип и заголовок ошибки по умолчанию для кода ответа: их получают исключения без своего описания. */
export const DEFAULT_PROBLEMS: Record<number, { type: string; title: string }> = {
  400: { type: 'bad-request', title: 'Некорректный запрос' },
  401: { type: 'unauthorized', title: 'Требуется вход' },
  403: { type: 'forbidden', title: 'Недостаточно прав' },
  404: { type: 'not-found', title: 'Не найдено' },
  405: { type: 'method-not-allowed', title: 'Метод не поддерживается' },
  409: { type: 'conflict', title: 'Конфликт с текущим состоянием' },
  413: { type: 'payload-too-large', title: 'Слишком большой запрос' },
  415: { type: 'unsupported-media-type', title: 'Неподдерживаемый тип содержимого' },
  422: { type: 'unprocessable-entity', title: 'Запрос невозможно обработать' },
  429: { type: 'too-many-requests', title: 'Слишком много запросов' },
  500: { type: 'internal', title: 'Внутренняя ошибка сервера' },
  501: { type: 'not-implemented', title: 'Метод ещё не реализован' },
  503: { type: 'service-unavailable', title: 'Сервис временно недоступен' },
};

export function defaultProblem(status: number): { type: string; title: string } {
  return DEFAULT_PROBLEMS[status] ?? (status < 500 ? DEFAULT_PROBLEMS[400] : DEFAULT_PROBLEMS[500]);
}

export function problemType(slug: string): string {
  return slug.startsWith('http') ? slug : PROBLEM_TYPE_BASE + slug;
}
