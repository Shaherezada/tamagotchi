import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser } from '@app/common';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARE_TAG } from '../swagger';
import { CareActionsService } from './care-actions.service';
import { CareActionDto } from './dto/care-action.dto';
import { CareActionsQuery } from './dto/care-actions-query.dto';
import { CareResultDto } from './dto/care-result.dto';
import { CreateCareActionDto } from './dto/create-care-action.dto';

@ApiTags(CARE_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('care-actions')
export class CareActionsController {
  constructor(private readonly careActions: CareActionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Действие ухода',
    description:
      'Кормить, угостить, играть, убрать, лечить, воспитывать, свет. Предмет списывается, эффект применяет ' +
      'pets-service по gRPC; при отказе предмет возвращается',
  })
  @ApiOkResponse({ type: CareResultDto, description: 'Действие применено, новое состояние питомца' })
  @ApiProblems(
    400,
    401,
    [404, 'Нет питомца, он чужой, или нет предмета'],
    [409, 'Питомец спит, ещё яйцо или умер; предмета нет в инвентаре или он не подходит к действию'],
    [503, 'pets-service недоступен: действие осталось PENDING и будет повторено'],
  )
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCareActionDto): Promise<CareResultDto> {
    return this.careActions.perform(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'История ухода', description: 'Мои действия, новые первыми; petId – по одному питомцу' })
  @ApiOkResponse({ type: [CareActionDto], description: 'Действия ухода' })
  @ApiProblems(400, 401, [404, 'Нет питомца или он чужой'])
  list(@CurrentUser() user: JwtUser, @Query() query: CareActionsQuery): Promise<CareActionDto[]> {
    return this.careActions.list(user.sub, query);
  }
}
