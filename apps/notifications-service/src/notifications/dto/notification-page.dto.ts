import { ApiProperty } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto], description: 'Новые первыми' })
  items: NotificationDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Курсор следующей страницы; null – страниц больше нет' })
  nextCursor: string | null;
}
