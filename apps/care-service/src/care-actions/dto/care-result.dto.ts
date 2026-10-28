import { ApiProperty } from '@nestjs/swagger';
import { CareActionDto } from './care-action.dto';
import { PetSnapshot } from './pet-snapshot.dto';

export class CareResultDto {
  @ApiProperty({ type: CareActionDto })
  action: CareActionDto;

  @ApiProperty({ type: PetSnapshot, description: 'Состояние питомца после ухода' })
  pet: PetSnapshot;
}
