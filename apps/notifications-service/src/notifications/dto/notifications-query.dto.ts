import { ToBoolean } from '@app/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class NotificationsQuery {
  @ApiPropertyOptional({ description: 'Только непрочитанные', default: false })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'nextCursor из предыдущей страницы', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
