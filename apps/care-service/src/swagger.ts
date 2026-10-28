import type { SwaggerOptions } from '@app/common';

export const CARE_TAG = 'care-service';

export const CARE_SWAGGER: SwaggerOptions = {
  service: CARE_TAG,
  docsName: 'care',
  title: 'care-service – уход и предметы',
  description: 'Каталог предметов, магазин, кошелёк, инвентарь, действия ухода за питомцем',
};
