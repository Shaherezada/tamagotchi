import { PetName } from './pet-name';

export class RenamePetDto {
  @PetName()
  name: string;
}
