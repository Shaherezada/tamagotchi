import { Module } from '@nestjs/common';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { AdminPetsController } from './admin-pets.controller';

@Module({
  imports: [LifecycleModule],
  controllers: [AdminPetsController],
})
export class AdminModule {}
