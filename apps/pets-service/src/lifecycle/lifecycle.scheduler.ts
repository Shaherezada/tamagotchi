import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PetsEnv } from '../pets-env';
import { LifecycleService } from './lifecycle.service';

const BATCH_SIZE = 100;
// за один тик – не больше стольких пачек, чтобы долгий простой не занял планировщик надолго
const MAX_BATCHES = 10;

/** Планировщик жизненного цикла: раз в TICK_MS вызывает processDue. */
@Injectable()
export class LifecycleScheduler implements OnModuleInit {
  private readonly logger = new Logger(LifecycleScheduler.name);
  private running = false;

  constructor(
    private readonly lifecycle: LifecycleService,
    private readonly env: PetsEnv,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.addInterval(
      'pets-lifecycle',
      setInterval(() => void this.tick(), this.env.TICK_MS),
    );
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        if ((await this.lifecycle.processDue(BATCH_SIZE)) < BATCH_SIZE) {
          break;
        }
      }
    } catch (error) {
      this.logger.error('Ошибка тика жизненного цикла', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
