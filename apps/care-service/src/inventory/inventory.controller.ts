import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser } from '@app/common';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARE_TAG } from '../swagger';
import { InventoryItemDto } from './dto/inventory-item.dto';
import { InventoryService } from './inventory.service';

@ApiTags(CARE_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Мой инвентарь' })
  @ApiOkResponse({ type: [InventoryItemDto], description: 'Предметы игрока с количеством' })
  @ApiProblems(401)
  list(@CurrentUser() user: JwtUser): Promise<InventoryItemDto[]> {
    return this.inventory.list(user.sub);
  }
}
