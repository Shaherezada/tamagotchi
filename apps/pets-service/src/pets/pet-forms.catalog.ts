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

export const EGG_FORM = 'egg';
/** Хорошая форма – ошибок меньше; плохая – от BAD_FORM_MISTAKES; лучшая взрослая – ещё и дисциплина. */
export const GOOD_FORM_MAX_MISTAKES = 1;
export const BAD_FORM_MISTAKES = 5;
export const STAR_FORM_DISCIPLINE = 50;

/** Код формы при переходе на стадию (§8, таблица форм). */
export function chooseFormCode(stage: Stage, careMistakes: number, discipline: number): string {
  switch (stage) {
    case Stage.EGG:
      return EGG_FORM;
    case Stage.BABY:
      return 'baby';
    case Stage.ELDER:
      return 'elder';
    default: {
      const prefix = stage.toLowerCase();
      if (careMistakes >= BAD_FORM_MISTAKES) {
        return `${prefix}_bad`;
      }
      if (careMistakes > GOOD_FORM_MAX_MISTAKES) {
        return `${prefix}_normal`;
      }
      return stage === Stage.ADULT && discipline >= STAR_FORM_DISCIPLINE ? 'adult_star' : `${prefix}_good`;
    }
  }
}

/** Форма из справочника по коду: та же строка, что сид кладёт в pet_forms. */
export function petFormByCode(code: string): PetFormSeed & { imageKey: string } {
  const form = PET_FORMS.find((f) => f.code === code);
  if (!form) {
    throw new Error(`Неизвестная форма питомца ${code}`);
  }
  return { ...form, imageKey: petFormImageKey(code) };
}
