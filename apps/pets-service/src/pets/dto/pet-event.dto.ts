import { ApiProperty } from '@nestjs/swagger';
import { PetEventType } from '../pet-enums';

export class PetEventDto {
  @ApiProperty({
    enum: PetEventType,
    enumName: 'PetEventType',
    example: PetEventType.EVOLVED,
    description: 'Тип записи хронологии: HUNGRY…MISBEHAVING – начало зова, CARE – уход, CARE_MISTAKE – ошибка ухода',
  })
  type: string;

  @ApiProperty({ type: 'object', additionalProperties: true, example: { fromStage: 'BABY', toStage: 'CHILD' } })
  details: object;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt: Date;
}
