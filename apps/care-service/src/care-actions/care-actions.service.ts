import { Injectable, NotImplementedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { WalletService } from '../wallet/wallet.service';
import type { CareAction } from './care-action.entity';
import { CareActionDto } from './dto/care-action.dto';
import { CareActionsQuery } from './dto/care-actions-query.dto';
import { CareResultDto } from './dto/care-result.dto';
import { CreateCareActionDto } from './dto/create-care-action.dto';
import { PetCareClient } from './pet-care.client';

/** Награда за игру, если настроение действительно выросло (§9). */
export const PLAY_REWARD_COINS = 5;

/**
 * Сага ухода (§9): списать предмет и записать PENDING, вызвать pets-service, затем APPLIED
 * или компенсация (вернуть предмет, REJECTED); недоступен pets-service – 503, действие остаётся PENDING.
 */
@Injectable()
export class CareActionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly wallet: WalletService,
    private readonly pets: PetCareClient,
  ) {}

  perform(_userId: string, _dto: CreateCareActionDto): Promise<CareResultDto> {
    throw new NotImplementedException();
  }

  list(_userId: string, _query: CareActionsQuery): Promise<CareActionDto[]> {
    throw new NotImplementedException();
  }

  /** Повтор зависшего действия с тем же actionId; после 5 попыток – вернуть предмет и REJECTED. */
  retry(_action: CareAction): Promise<void> {
    throw new NotImplementedException();
  }
}
