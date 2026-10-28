import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { MAX_ALIVE_PETS, MAX_HEARTS, START_DISCIPLINE, START_WEIGHT } from '../lifecycle/game-rules';
import { PetsEnv } from '../pets-env';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetEventDto } from './dto/pet-event.dto';
import { PetDto } from './dto/pet.dto';
import { PetsQuery } from './dto/pets-query.dto';
import { RenamePetDto } from './dto/rename-pet.dto';
import { PetEvent } from './entities/pet-event.entity';
import { PetForm } from './entities/pet-form.entity';
import { Pet } from './entities/pet.entity';
import { PetEventType, PetStatus, Stage } from './pet-enums';
import { EGG_FORM } from './pet-forms.catalog';
import { toPetDto, toPetEventDto } from './pet.mapper';

/** Питомцы игрока; каждый запрос ограничен ownerId из токена, чужой питомец – 404. */
@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet) private readonly pets: Repository<Pet>,
    @InjectRepository(PetForm) private readonly forms: Repository<PetForm>,
    @InjectRepository(PetEvent) private readonly events: Repository<PetEvent>,
    private readonly env: PetsEnv,
  ) {}

  async create(ownerId: string, dto: CreatePetDto): Promise<PetDto> {
    const egg = await this.forms.findOneBy({ code: EGG_FORM });
    if (!egg) {
      throw new Error('В pet_forms нет формы egg: запустите сид pets-service');
    }
    const pet = await this.pets.manager.transaction(async (manager) => {
      // два одновременных запроса одного игрока не должны оба пройти проверку «не больше трёх»
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ownerId]);
      const alive = await manager.countBy(Pet, { ownerId, diedAt: IsNull() });
      if (alive >= MAX_ALIVE_PETS) {
        throw ProblemException.conflict(
          'too-many-pets',
          'Уже три живых питомца',
          `Живых питомцев может быть не больше ${MAX_ALIVE_PETS}`,
        );
      }
      const now = new Date();
      const created = manager.create(Pet, {
        ownerId,
        name: dto.name,
        stage: Stage.EGG,
        form: egg,
        hunger: MAX_HEARTS,
        happiness: MAX_HEARTS,
        discipline: START_DISCIPLINE,
        weight: START_WEIGHT,
        poopCount: 0,
        isSick: false,
        isSleeping: false,
        attention: null,
        attentionSince: null,
        mistakeCounted: false,
        careMistakes: 0,
        starvingSince: null,
        bornAt: now,
        stageSince: now,
        simulatedAt: now,
        // ближайший тик планировщика сам посчитает, когда питомцу вылупляться
        nextTickAt: now,
        diedAt: null,
        deathCause: null,
      });
      await manager.save(created);
      await manager.insert(PetEvent, { pet: created, type: PetEventType.BORN, details: {}, occurredAt: now });
      return created;
    });
    return toPetDto(pet, this.env);
  }

  async list(ownerId: string, query: PetsQuery): Promise<PetDto[]> {
    const dead = query.status === PetStatus.DEAD;
    const pets = await this.pets.find({
      where: { ownerId, diedAt: dead ? Not(IsNull()) : IsNull() },
      relations: { form: true },
      order: dead ? { diedAt: 'DESC' } : { bornAt: 'ASC' },
    });
    return pets.map((pet) => toPetDto(pet, this.env));
  }

  async get(ownerId: string, petId: string): Promise<PetDto> {
    return toPetDto(await this.findOwn(ownerId, petId), this.env);
  }

  async rename(ownerId: string, petId: string, dto: RenamePetDto): Promise<PetDto> {
    const pet = await this.findOwn(ownerId, petId);
    if (pet.diedAt) {
      throw ProblemException.conflict('pet-dead', 'Питомец умер', 'Умершего питомца нельзя переименовать');
    }
    await this.pets.update({ id: pet.id }, { name: dto.name });
    pet.name = dto.name;
    return toPetDto(pet, this.env);
  }

  async history(ownerId: string, petId: string): Promise<PetEventDto[]> {
    const pet = await this.findOwn(ownerId, petId);
    const events = await this.events.find({
      where: { pet: { id: pet.id } },
      order: { occurredAt: 'DESC', id: 'DESC' },
    });
    return events.map(toPetEventDto);
  }

  private async findOwn(ownerId: string, petId: string): Promise<Pet> {
    const pet = await this.pets.findOne({ where: { id: petId, ownerId }, relations: { form: true } });
    if (!pet) {
      throw ProblemException.notFound('Питомец не найден', `Питомца ${petId} нет среди ваших`, 'pet-not-found');
    }
    return pet;
  }
}
