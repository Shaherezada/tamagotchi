import { ApiProperty } from '@nestjs/swagger';
import { IsNickname } from './validation';

export class UpdateUserDto {
  @ApiProperty({ example: 'Мария', minLength: 1, maxLength: 32 })
  @IsNickname()
  nickname: string;
}
