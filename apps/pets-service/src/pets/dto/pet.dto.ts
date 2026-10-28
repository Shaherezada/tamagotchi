import { ApiProperty } from '@nestjs/swagger';
import { Attention, DeathCause, Stage } from '../pet-enums';
import { PetFormDto } from './pet-form.dto';

export class PetDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Пушок' })
  name: string;

  @ApiProperty({ enum: Stage, enumName: 'Stage', example: Stage.CHILD })
  stage: Stage;

  @ApiProperty({ type: PetFormDto })
  form: PetFormDto;

  @ApiProperty({ description: 'Сытость, сердечки 0–4', minimum: 0, maximum: 4, example: 3 })
  hunger: number;

  @ApiProperty({ description: 'Настроение, сердечки 0–4', minimum: 0, maximum: 4, example: 2 })
  happiness: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 50 })
  discipline: number;

  @ApiProperty({ minimum: 1, example: 12 })
  weight: number;

  @ApiProperty({ minimum: 0, maximum: 4, example: 1 })
  poopCount: number;

  @ApiProperty()
  isSick: boolean;

  @ApiProperty()
  isSleeping: boolean;

  // nullable-перечисление описано на месте: со ссылкой на схему Swagger теряет type рядом с nullable
  @ApiProperty({
    type: 'string',
    enum: Object.values(Attention),
    nullable: true,
    description: 'Чего питомец требует сейчас',
  })
  attention: Attention | null;

  @ApiProperty({ minimum: 0, example: 1 })
  careMistakes: number;

  @ApiProperty({ type: String, format: 'date-time' })
  bornAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  diedAt: Date | null;

  @ApiProperty({ type: 'string', enum: Object.values(DeathCause), nullable: true })
  deathCause: DeathCause | null;
}
