import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsPassword } from './validation';

export class ChangePasswordDto {
  @ApiProperty({ example: 'secret123', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  currentPassword: string;

  @ApiProperty({ example: 'newSecret456', minLength: 8, maxLength: 64, description: 'Хотя бы одна буква и одна цифра' })
  @IsPassword()
  newPassword: string;
}
