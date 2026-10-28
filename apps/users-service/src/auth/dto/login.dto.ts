import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'masha', maxLength: 32 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  login: string;

  @ApiProperty({ example: 'secret123', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  password: string;
}
