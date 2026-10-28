/** Тип действия ухода (§9). */
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

export enum CareStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
}
