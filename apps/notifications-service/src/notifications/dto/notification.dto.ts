import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../notification-type.enum';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type: NotificationType;

  @ApiProperty({ example: 'Питомец голоден' })
  title: string;

  @ApiProperty({ example: 'Пушок давно ничего не ел – покормите его' })
  body: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  petId: string | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
