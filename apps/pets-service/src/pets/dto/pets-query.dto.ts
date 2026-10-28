import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PetStatus } from '../pet-enums';

export class PetsQuery {
  @ApiPropertyOptional({ enum: PetStatus, enumName: 'PetStatus', default: PetStatus.ALIVE })
  @IsOptional()
  @IsEnum(PetStatus)
  status: PetStatus = PetStatus.ALIVE;
}
