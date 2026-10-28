/** Стартовый набор по user.registered (§6, таблица «Стартовый набор» в architecture.md). */
export const STARTER_COINS = 100;

export const STARTER_ITEMS: { code: string; quantity: number }[] = [
  { code: 'rice', quantity: 3 },
  { code: 'candy', quantity: 2 },
  { code: 'pill', quantity: 1 },
  { code: 'ball', quantity: 1 },
];

/** Награда по pet.evolved за переход на стадию; за остальные стадии награды нет. */
export const EVOLUTION_REWARDS: Record<string, number> = {
  ADULT: 50,
  ELDER: 100,
};
