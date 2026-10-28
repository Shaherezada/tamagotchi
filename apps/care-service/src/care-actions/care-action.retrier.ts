import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareAction } from './care-action.entity';
import { CareActionsService } from './care-actions.service';

/** Досылка (§9): раз в 30 с повторяет действия в PENDING старше 30 с (интервал регистрирует сессия C). */
@Injectable()
export class CareActionRetrier {
  constructor(
    private readonly careActions: CareActionsService,
    @InjectRepository(CareAction) private readonly actions: Repository<CareAction>,
  ) {}

  retryPending(): Promise<void> {
    throw new NotImplementedException();
  }
}
