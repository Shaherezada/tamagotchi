import { Injectable, NotImplementedException } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';

/** Планировщик жизненного цикла: раз в TICK_MS вызывает processDue (интервал регистрирует сессия B). */
@Injectable()
export class LifecycleScheduler {
  constructor(private readonly lifecycle: LifecycleService) {}

  tick(): Promise<void> {
    throw new NotImplementedException();
  }
}
