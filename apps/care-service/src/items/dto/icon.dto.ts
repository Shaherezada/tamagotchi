import { ApiProperty } from '@nestjs/swagger';

export class IconDto {
  @ApiProperty({
    format: 'uri',
    example: 'http://localhost:9000/tamagotchi-media/items/3f1c2a4e-8b1d-4c7e-9f2a-5d6b7c8e9f01.png',
  })
  iconUrl: string;
}
