import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';

/**
 * UUID в пути. Неверный формат – 404, а не 400: объекта с таким id нет, а таблица ошибок §10
 * для методов чтения и удаления по id не содержит 400.
 */
export const ParseIdPipe = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });
