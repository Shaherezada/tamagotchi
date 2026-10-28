import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetEventDto } from './dto/pet-event.dto';
import { PetDto } from './dto/pet.dto';
import { PetsQuery } from './dto/pets-query.dto';
import { RenamePetDto } from './dto/rename-pet.dto';
import { PetEvent } from './entities/pet-event.entity';
import { PetForm } from './entities/pet-form.entity';
import { Pet } from './entities/pet.entity';

/** Питомцы игрока; каждый запрос ограничен ownerId из токена, чужой питомец – 404. */
@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet) private readonly pets: Repository<Pet>,
    @InjectRepository(PetForm) private readonly forms: Repository<PetForm>,
    @InjectRepository(PetEvent) private readonly events: Repository<PetEvent>,
  ) {}

  create(_ownerId: string, _dto: CreatePetDto): Promise<PetDto> {
    throw new NotImplementedException();
  }

  list(_ownerId: string, _query: PetsQuery): Promise<PetDto[]> {
    throw new NotImplementedException();
  }

  get(_ownerId: string, _petId: string): Promise<PetDto> {
    throw new NotImplementedException();
  }

  rename(_ownerId: string, _petId: string, _dto: RenamePetDto): Promise<PetDto> {
    throw new NotImplementedException();
  }

  history(_ownerId: string, _petId: string): Promise<PetEventDto[]> {
    throw new NotImplementedException();
  }
}
