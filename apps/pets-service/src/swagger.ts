import type { SwaggerOptions } from '@app/common';

export const PETS_TAG = 'pets-service';

export const PETS_SWAGGER: SwaggerOptions = {
  service: PETS_TAG,
  docsName: 'pets',
  title: 'pets-service – питомцы',
  description: 'Питомцы игрока и их жизнь во времени; перемотка времени для демонстрации. gRPC PetCare – :50051',
};
