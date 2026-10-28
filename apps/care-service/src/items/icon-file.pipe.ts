import { ProblemException } from '@app/common';
import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';

export const ICON_FIELD = 'icon';
export const ICON_MAX_BYTES = 512 * 1024;
export const ICON_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Проверка загружаемой иконки (§11): нет файла – 400, не PNG/JPEG/WebP – 415.
 * Размер ограничивает multer (limits.fileSize) – это 413.
 */
@Injectable()
export class IconFilePipe implements PipeTransform<Express.Multer.File | undefined, Express.Multer.File> {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new ProblemException({
        status: HttpStatus.BAD_REQUEST,
        type: 'icon-required',
        title: 'Нет файла иконки',
        detail: `Передайте файл в поле ${ICON_FIELD} (multipart/form-data)`,
      });
    }
    if (!ICON_TYPES.includes(file.mimetype)) {
      throw new ProblemException({
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        type: 'unsupported-icon-type',
        title: 'Неподдерживаемый тип иконки',
        detail: `Допустимы ${ICON_TYPES.join(', ')}`,
      });
    }
    return file;
  }
}
