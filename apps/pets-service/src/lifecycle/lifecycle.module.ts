import { OutboxModule } from '@app/common';
import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { PetsEnv } from '../pets-env';
import { GameRules, gameRulesFromEnv } from './game-rules';
import { LifecycleScheduler } from './lifecycle.scheduler';
import { LifecycleService } from './lifecycle.service';

@Module({
  imports: [PetsModule, OutboxModule],
  providers: [
    LifecycleService,
    LifecycleScheduler,
    { provide: GameRules, inject: [PetsEnv], useFactory: gameRulesFromEnv },
  ],
  exports: [LifecycleService, GameRules],
})
export class LifecycleModule {}
