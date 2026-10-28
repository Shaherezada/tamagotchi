import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Stage } from '../pet-enums';

/** Справочник форм питомца; картинка лежит в Silo по image_key. Коды – таблица форм в architecture.md. */
@Entity('pet_forms')
export class PetForm {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 8 })
  stage: Stage;

  @Column({ type: 'varchar', length: 32 })
  title: string;

  @Column({ type: 'varchar', length: 256 })
  description: string;

  @Column({ name: 'image_key', type: 'varchar', length: 128 })
  imageKey: string;
}
