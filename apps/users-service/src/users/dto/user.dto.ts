import { Role } from '@app/common';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'masha' })
  login: string;

  @ApiProperty({ example: 'Маша' })
  nickname: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.PLAYER })
  role: Role;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
