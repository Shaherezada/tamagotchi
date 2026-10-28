import { ApiProperty } from '@nestjs/swagger';
import { IsLogin, IsNickname, IsPassword } from '../../users/dto/validation';

export class RegisterDto {
  @ApiProperty({ example: 'masha', minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9_]{3,32}$' })
  @IsLogin()
  login: string;

  @ApiProperty({ example: 'Маша', minLength: 1, maxLength: 32 })
  @IsNickname()
  nickname: string;

  @ApiProperty({ example: 'secret123', minLength: 8, maxLength: 64, description: 'Хотя бы одна буква и одна цифра' })
  @IsPassword()
  password: string;
}
