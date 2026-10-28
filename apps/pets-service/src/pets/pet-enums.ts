/** Стадия жизни (§8). */
export enum Stage {
  EGG = 'EGG',
  BABY = 'BABY',
  CHILD = 'CHILD',
  TEEN = 'TEEN',
  ADULT = 'ADULT',
  ELDER = 'ELDER',
}

/** Следующая стадия; у ELDER её нет – конец жизни. */
export const NEXT_STAGE: Record<Stage, Stage | null> = {
  [Stage.EGG]: Stage.BABY,
  [Stage.BABY]: Stage.CHILD,
  [Stage.CHILD]: Stage.TEEN,
  [Stage.TEEN]: Stage.ADULT,
  [Stage.ADULT]: Stage.ELDER,
  [Stage.ELDER]: null,
};

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

/** Действие ухода (pets.proto, поле type). */
export enum CareType {
  FEED = 'FEED',
  SNACK = 'SNACK',
  PLAY = 'PLAY',
  CLEAN = 'CLEAN',
  HEAL = 'HEAL',
  SCOLD = 'SCOLD',
  LIGHTS_OFF = 'LIGHTS_OFF',
  LIGHTS_ON = 'LIGHTS_ON',
}

/** Тип записи хронологии (pet_events.type). HUNGRY…MISBEHAVING – начало зова, совпадают с Attention. */
export enum PetEventType {
  BORN = 'BORN',
  EVOLVED = 'EVOLVED',
  HUNGRY = 'HUNGRY',
  UNHAPPY = 'UNHAPPY',
  DIRTY = 'DIRTY',
  SICK = 'SICK',
  MISBEHAVING = 'MISBEHAVING',
  CARE = 'CARE',
  CARE_MISTAKE = 'CARE_MISTAKE',
  DIED = 'DIED',
}

/** За что засчитана ошибка ухода (§8). */
export enum CareMistakeReason {
  IGNORED_CALL = 'IGNORED_CALL',
  OVERFED = 'OVERFED',
  NEEDLESS_HEAL = 'NEEDLESS_HEAL',
  NEEDLESS_SCOLD = 'NEEDLESS_SCOLD',
}
