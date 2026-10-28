import { ApiProblems, BEARER_AUTH, ParseIdPipe, Role, Roles } from '@app/common';
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PetDto } from '../pets/dto/pet.dto';
import { PETS_TAG } from '../swagger';
import { TimeTravelDto } from './dto/time-travel.dto';

@ApiTags(PETS_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Roles(Role.ADMIN)
@Controller('admin/pets')
export class AdminPetsController {
  constructor(private readonly lifecycle: LifecycleService) {}

  @Post(':petId/time-travel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Перемотать время питомца (демо)',
    description: 'Только администратор и только при DEMO_MODE=true; питомец сразу проживает gameMinutes',
  })
  @ApiParam({ name: 'petId', format: 'uuid' })
  @ApiOkResponse({ type: PetDto, description: 'Состояние после перемотки' })
  @ApiProblems(400, 401, [403, 'Нет роли admin или выключен DEMO_MODE'], 404)
  timeTravel(@Param('petId', ParseIdPipe) petId: string, @Body() dto: TimeTravelDto): Promise<PetDto> {
    return this.lifecycle.timeTravel(petId, dto.gameMinutes);
  }
}
