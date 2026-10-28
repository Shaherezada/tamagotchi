import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser } from '@app/common';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARE_TAG } from '../swagger';
import { PurchaseResultDto } from './dto/purchase-result.dto';
import { PurchaseDto } from './dto/purchase.dto';
import { ShopService } from './shop.service';

@ApiTags(CARE_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly shop: ShopService) {}

  @Post()
  @ApiOperation({ summary: 'Купить предмет', description: 'Списание монет и пополнение инвентаря – одной транзакцией' })
  @ApiCreatedResponse({ type: PurchaseResultDto, description: 'Покупка и новый баланс' })
  @ApiProblems(400, 401, [404, 'Предмет не найден или снят с продажи'], [409, 'Не хватает монет'])
  buy(@CurrentUser() user: JwtUser, @Body() dto: PurchaseDto): Promise<PurchaseResultDto> {
    return this.shop.buy(user.sub, dto);
  }
}
