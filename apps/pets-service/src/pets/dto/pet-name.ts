import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Имя питомца: 1–24 символа (pets.name VARCHAR(24)), пробелы по краям обрезаются. */
export function PetName(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'Пушок', minLength: 1, maxLength: 24 }),
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    Length(1, 24),
  );
}
