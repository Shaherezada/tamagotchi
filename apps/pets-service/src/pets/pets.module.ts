import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppliedCareAction } from './entities/applied-care-action.entity';
import { PetEvent } from './entities/pet-event.entity';
import { PetForm } from './entities/pet-form.entity';
import { Pet } from './entities/pet.entity';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, PetForm, PetEvent, AppliedCareAction])],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [TypeOrmModule],
})
export class PetsModule {}
