import { OutboxService } from '@app/common';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PetDto } from '../pets/dto/pet.dto';
import { GameRules } from './game-rules';

@Injectable()
export class LifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly rules: GameRules,
  ) {}

  /**
   * Тик: до limit живых питомцев с next_tick_at <= now() через FOR UPDATE SKIP LOCKED, simulate,
   * питомец, хронология и outbox – одной транзакцией. Возвращает число обработанных питомцев.
   */
  processDue(_limit: number): Promise<number> {
    throw new NotImplementedException();
  }

  /** Перемотка для демонстрации (только DEMO_MODE): сдвиг отметок времени назад и сразу simulate. */
  timeTravel(_petId: string, _minutes: number): Promise<PetDto> {
    throw new NotImplementedException();
  }
}
