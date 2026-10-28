import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TimeTravelDto {
  @ApiProperty({ description: 'На сколько игровых минут прожить вперёд', minimum: 1, maximum: 14400, example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14400)
  gameMinutes: number;
}
