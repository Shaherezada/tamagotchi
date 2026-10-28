import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser } from '@app/common';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARE_TAG } from '../swagger';
import { WalletQuery } from './dto/wallet-query.dto';
import { WalletDto } from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags(CARE_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Баланс и журнал операций' })
  @ApiOkResponse({ type: WalletDto, description: 'Кошелёк игрока' })
  @ApiProblems(400, 401)
  get(@CurrentUser() user: JwtUser, @Query() query: WalletQuery): Promise<WalletDto> {
    return this.wallet.get(user.sub, query.limit);
  }
}
