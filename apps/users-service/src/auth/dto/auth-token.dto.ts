import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenDto {
  @ApiProperty({ format: 'uuid', example: '3f1c2a4e-8b1d-4c7e-9f2a-5d6b7c8e9f01' })
  userId: string;

  @ApiProperty({ description: 'JWT RS256 для заголовка Authorization: Bearer', example: 'eyJhbGciOiJSUzI1NiIs…' })
  accessToken: string;

  @ApiProperty({ description: 'Срок жизни токена, секунды', example: 3600 })
  expiresIn: number;
}
