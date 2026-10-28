import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldError {
  @ApiProperty({ example: 'quantity', description: 'Поле запроса, путь через точку для вложенных' })
  field: string;

  @ApiProperty({ example: 'quantity must not be less than 1' })
  message: string;
}

/** Ответ-ошибка по RFC 9457, Content-Type: application/problem+json (§10). */
export class ProblemDetails {
  @ApiProperty({ example: 'https://tamagotchi.local/problems/insufficient-funds', format: 'uri' })
  type: string;

  @ApiProperty({ example: 'Недостаточно монет' })
  title: string;

  @ApiProperty({ example: 409 })
  status: number;

  @ApiPropertyOptional({ example: 'Покупка стоит 30 монет, на счету 12' })
  detail?: string;

  @ApiProperty({ example: '/api/purchases' })
  instance: string;

  @ApiProperty({ example: 'c1a7d1f2-6a43-4f0e-9e7d-2b8c1a9d0e11', description: 'Значение заголовка X-Request-Id' })
  requestId: string;

  @ApiPropertyOptional({ type: [FieldError], description: 'Только у ошибки валидации (400)' })
  errors?: FieldError[];
}
