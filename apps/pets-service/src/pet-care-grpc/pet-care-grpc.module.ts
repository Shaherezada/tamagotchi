import { OutboxModule } from '@app/common';
import { Module } from '@nestjs/common';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { PetsModule } from '../pets/pets.module';
import { PetCareGrpcController } from './pet-care-grpc.controller';
import { PetCareService } from './pet-care.service';

@Module({
  imports: [PetsModule, LifecycleModule, OutboxModule],
  controllers: [PetCareGrpcController],
  providers: [PetCareService],
})
export class PetCareGrpcModule {}
