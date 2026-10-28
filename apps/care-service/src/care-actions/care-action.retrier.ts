import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CareAction } from './care-action.entity';
import { CareActionsService } from './care-actions.service';
import { CareStatus } from './care-enums';

/** Период досылки и возраст зависшего действия (§9). */
export const RETRY_INTERVAL_MS = 30_000;
export const RETRY_AFTER_MS = 30_000;
const RETRY_BATCH = 20;

/** Досылка (§9): раз в 30 с повторяет действия в PENDING старше 30 с. */
@Injectable()
export class CareActionRetrier {
  private readonly logger = new Logger(CareActionRetrier.name);
  private running = false;

  constructor(
    private readonly careActions: CareActionsService,
    @InjectRepository(CareAction) private readonly actions: Repository<CareAction>,
  ) {}

  @Interval(RETRY_INTERVAL_MS)
  async retryPending(): Promise<void> {
    // прошлый проход ещё идёт (pets-service медленно отвечает) – не накладываемся
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const pending = await this.actions.find({
        where: { status: CareStatus.PENDING, createdAt: LessThan(new Date(Date.now() - RETRY_AFTER_MS)) },
        relations: { item: true },
        order: { createdAt: 'ASC' },
        take: RETRY_BATCH,
      });
      for (const action of pending) {
        await this.careActions.retry(action).catch((error: Error) => {
          this.logger.error(`Досылка ${action.id} не удалась: ${error.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Досылка: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
