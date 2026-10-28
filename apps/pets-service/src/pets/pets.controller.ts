import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser, ParseIdPipe } from '@app/common';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PETS_TAG } from '../swagger';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetEventDto } from './dto/pet-event.dto';
import { PetDto } from './dto/pet.dto';
import { PetsQuery } from './dto/pets-query.dto';
import { RenamePetDto } from './dto/rename-pet.dto';
import { PetsService } from './pets.service';

@ApiTags(PETS_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Post()
  @ApiOperation({ summary: 'Завести питомца', description: 'Питомец появляется яйцом (EGG); живых – не больше трёх' })
  @ApiCreatedResponse({ type: PetDto, description: 'Новый питомец' })
  @ApiProblems(400, 401, [409, 'Уже три живых питомца'])
  create(@CurrentUser() user: JwtUser, @Body() dto: CreatePetDto): Promise<PetDto> {
    return this.pets.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Мои питомцы', description: 'status=alive (по умолчанию) – живые, dead – умершие' })
  @ApiOkResponse({ type: [PetDto], description: 'Список питомцев' })
  @ApiProblems(400, 401)
  list(@CurrentUser() user: JwtUser, @Query() query: PetsQuery): Promise<PetDto[]> {
    return this.pets.list(user.sub, query);
  }

  @Get(':petId')
  @ApiOperation({ summary: 'Состояние питомца' })
  @ApiParam({ name: 'petId', format: 'uuid' })
  @ApiOkResponse({ type: PetDto, description: 'Питомец' })
  @ApiProblems(401, 404)
  get(@CurrentUser() user: JwtUser, @Param('petId', ParseIdPipe) petId: string): Promise<PetDto> {
    return this.pets.get(user.sub, petId);
  }

  @Patch(':petId')
  @ApiOperation({ summary: 'Переименовать питомца' })
  @ApiParam({ name: 'petId', format: 'uuid' })
  @ApiOkResponse({ type: PetDto, description: 'Питомец с новым именем' })
  @ApiProblems(400, 401, 404, [409, 'Питомец умер'])
  rename(
    @CurrentUser() user: JwtUser,
    @Param('petId', ParseIdPipe) petId: string,
    @Body() dto: RenamePetDto,
  ): Promise<PetDto> {
    return this.pets.rename(user.sub, petId, dto);
  }

  @Get(':petId/events')
  @ApiOperation({ summary: 'Хронология жизни питомца', description: 'Вылупление, рост, болезни, ошибки ухода, смерть' })
  @ApiParam({ name: 'petId', format: 'uuid' })
  @ApiOkResponse({ type: [PetEventDto], description: 'Записи хронологии от новых к старым' })
  @ApiProblems(401, 404)
  history(@CurrentUser() user: JwtUser, @Param('petId', ParseIdPipe) petId: string): Promise<PetEventDto[]> {
    return this.pets.history(user.sub, petId);
  }
}
