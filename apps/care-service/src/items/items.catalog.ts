import { Category } from './category.enum';

export interface ItemSeed {
  code: string;
  title: string;
  description: string;
  category: Category;
  price: number;
  isConsumable: boolean;
  hungerDelta: number;
  happinessDelta: number;
  weightDelta: number;
  curesSickness: boolean;
}

/** Каталог предметов (таблица «Каталог предметов» в architecture.md, §8–9). */
export const ITEMS: ItemSeed[] = [
  {
    code: 'rice',
    title: 'Рис',
    description: 'Простая сытная еда: +1 сердечко сытости',
    category: Category.FOOD,
    price: 5,
    isConsumable: true,
    hungerDelta: 1,
    happinessDelta: 0,
    weightDelta: 1,
    curesSickness: false,
  },
  {
    code: 'fish',
    title: 'Рыбка',
    description: 'Плотный обед: +2 сердечка сытости',
    category: Category.FOOD,
    price: 12,
    isConsumable: true,
    hungerDelta: 2,
    happinessDelta: 0,
    weightDelta: 1,
    curesSickness: false,
  },
  {
    code: 'candy',
    title: 'Конфета',
    description: 'Лакомство: +1 сердечко настроения, но +3 к весу',
    category: Category.SNACK,
    price: 8,
    isConsumable: true,
    hungerDelta: 0,
    happinessDelta: 1,
    weightDelta: 3,
    curesSickness: false,
  },
  {
    code: 'cake',
    title: 'Пирожное',
    description: 'Праздничное лакомство: +2 сердечка настроения, +3 к весу',
    category: Category.SNACK,
    price: 15,
    isConsumable: true,
    hungerDelta: 0,
    happinessDelta: 2,
    weightDelta: 3,
    curesSickness: false,
  },
  {
    code: 'pill',
    title: 'Таблетка',
    description: 'Лечит болезнь',
    category: Category.MEDICINE,
    price: 20,
    isConsumable: true,
    hungerDelta: 0,
    happinessDelta: 0,
    weightDelta: 0,
    curesSickness: true,
  },
  {
    code: 'ball',
    title: 'Мячик',
    description: 'Игрушка: +1 сердечко настроения, −1 к весу; не тратится',
    category: Category.TOY,
    price: 30,
    isConsumable: false,
    hungerDelta: 0,
    happinessDelta: 1,
    weightDelta: -1,
    curesSickness: false,
  },
  {
    code: 'teddy',
    title: 'Плюшевый мишка',
    description: 'Любимая игрушка: +2 сердечка настроения, −1 к весу; не тратится',
    category: Category.TOY,
    price: 60,
    isConsumable: false,
    hungerDelta: 0,
    happinessDelta: 2,
    weightDelta: -1,
    curesSickness: false,
  },
];
