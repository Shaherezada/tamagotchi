import { ApiProperty } from '@nestjs/swagger';

export class PetFormDto {
  @ApiProperty({ example: 'child_good' })
  code: string;

  @ApiProperty({ example: 'Солнышко' })
  title: string;

  @ApiProperty({ example: 'Весёлый и послушный ребёнок' })
  description: string;

  @ApiProperty({ example: 'http://localhost:9000/tamagotchi-media/pet-forms/child_good.png', format: 'uri' })
  imageUrl: string;
}
