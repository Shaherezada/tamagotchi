import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Какие уведомления о питомце присылать; приветствие приходит всегда. */
export class SettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  petHungry: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  petSick: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  petEvolved: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  petDied: boolean;
}
