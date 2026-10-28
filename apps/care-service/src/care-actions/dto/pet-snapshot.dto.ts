import type { PetSnapshot as PetSnapshotMessage } from '@app/contracts';
import { ApiProperty } from '@nestjs/swagger';

/** Состояние питомца из ответа gRPC PetCare (pets.proto) – схема для Swagger. */
export class PetSnapshot implements PetSnapshotMessage {
  @ApiProperty({ format: 'uuid' })
  petId: string;

  @ApiProperty({ example: 'Пушок' })
  name: string;

  @ApiProperty({ example: 'CHILD' })
  stage: string;

  @ApiProperty({ example: 'child_good' })
  formCode: string;

  @ApiProperty({ minimum: 0, maximum: 4, example: 4 })
  hunger: number;

  @ApiProperty({ minimum: 0, maximum: 4, example: 2 })
  happiness: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 50 })
  discipline: number;

  @ApiProperty({ minimum: 1, example: 11 })
  weight: number;

  @ApiProperty({ minimum: 0, maximum: 4, example: 0 })
  poopCount: number;

  @ApiProperty()
  isSick: boolean;

  @ApiProperty()
  isSleeping: boolean;

  @ApiProperty({ minimum: 0, example: 1 })
  careMistakes: number;

  @ApiProperty({ description: 'Этим действием допущена ошибка ухода' })
  careMistakeMade: boolean;
}
