import { Stage } from './pet-enums';

export interface PetFormSeed {
  code: string;
  stage: Stage;
  title: string;
  description: string;
}

/**
 * Формы питомца (таблица «Формы питомца» в architecture.md, §8). Форма при переходе на стадию –
 * по ошибкам ухода: меньше 2 – good, 2–4 – normal, 5 и больше – bad; adult_star – ещё и дисциплина от 50.
 */
export const PET_FORMS: PetFormSeed[] = [
  { code: 'egg', stage: Stage.EGG, title: 'Яйцо', description: 'Тёплое яйцо: скоро кто-то вылупится' },
  { code: 'baby', stage: Stage.BABY, title: 'Пушинка', description: 'Малыш: часто хочет есть и спать' },
  {
    code: 'child_good',
    stage: Stage.CHILD,
    title: 'Солнышко',
    description: 'Весёлый и послушный ребёнок: за ним хорошо ухаживали',
  },
  { code: 'child_normal', stage: Stage.CHILD, title: 'Колобок', description: 'Обычный ребёнок: уход был неровным' },
  { code: 'child_bad', stage: Stage.CHILD, title: 'Ворчун', description: 'Капризный ребёнок: о нём часто забывали' },
  { code: 'teen_good', stage: Stage.TEEN, title: 'Звёздочка', description: 'Любознательный подросток' },
  {
    code: 'teen_normal',
    stage: Stage.TEEN,
    title: 'Непоседа',
    description: 'Подросток, которому всё быстро надоедает',
  },
  { code: 'teen_bad', stage: Stage.TEEN, title: 'Хулиган', description: 'Подросток, привыкший к невниманию' },
  {
    code: 'adult_star',
    stage: Stage.ADULT,
    title: 'Чемпион',
    description: 'Лучшая взрослая форма: идеальный уход и строгое воспитание',
  },
  { code: 'adult_good', stage: Stage.ADULT, title: 'Умница', description: 'Здоровый и довольный взрослый питомец' },
  { code: 'adult_normal', stage: Stage.ADULT, title: 'Добряк', description: 'Спокойный взрослый питомец' },
  { code: 'adult_bad', stage: Stage.ADULT, title: 'Обжора', description: 'Взрослый питомец с плохими привычками' },
  { code: 'elder', stage: Stage.ELDER, title: 'Мудрец', description: 'Пожилой питомец доживает свои дни в покое' },
];

/** Ключ картинки формы в бакете Silo (§12). */
export function petFormImageKey(code: string): string {
  return `pet-forms/${code}.png`;
}
