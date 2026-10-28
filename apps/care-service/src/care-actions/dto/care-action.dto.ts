import { ApiProperty } from '@nestjs/swagger';
import { CareStatus, CareType } from '../care-enums';

export class CareActionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  petId: string;

  @ApiProperty({ enum: CareType, enumName: 'CareType' })
  type: CareType;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  itemId: string | null;

  @ApiProperty({ enum: CareStatus, enumName: 'CareStatus' })
  status: CareStatus;

  @ApiProperty({ type: String, nullable: true, example: 'PET_SLEEPING', description: 'Причина отказа для REJECTED' })
  rejectReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
