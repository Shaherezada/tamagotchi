import { ApiProperty } from '@nestjs/swagger';

export class PetEventDto {
  @ApiProperty({ example: 'EVOLVED', description: 'Тип записи хронологии' })
  type: string;

  @ApiProperty({ type: 'object', additionalProperties: true, example: { fromStage: 'BABY', toStage: 'CHILD' } })
  details: object;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt: Date;
}
