/** Стадия жизни (§8). */
export enum Stage {
  EGG = 'EGG',
  BABY = 'BABY',
  CHILD = 'CHILD',
  TEEN = 'TEEN',
  ADULT = 'ADULT',
  ELDER = 'ELDER',
}

/** Зов питомца: чего он сейчас требует (§8). */
export enum Attention {
  HUNGRY = 'HUNGRY',
  UNHAPPY = 'UNHAPPY',
  DIRTY = 'DIRTY',
  SICK = 'SICK',
  MISBEHAVING = 'MISBEHAVING',
}

export enum DeathCause {
  NEGLECT = 'NEGLECT',
  OLD_AGE = 'OLD_AGE',
}

/** Фильтр списка питомцев. */
export enum PetStatus {
  ALIVE = 'alive',
  DEAD = 'dead',
}
