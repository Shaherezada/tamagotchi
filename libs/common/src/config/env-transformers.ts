import { Transform } from 'class-transformer';

/** 'true' / '1' → true, 'false' / '0' → false; остальное оставляет как есть, чтобы его отклонил @IsBoolean. */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  });
}
