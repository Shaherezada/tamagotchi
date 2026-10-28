import { PetName } from './pet-name';

export class CreatePetDto {
  @PetName()
  name: string;
}
