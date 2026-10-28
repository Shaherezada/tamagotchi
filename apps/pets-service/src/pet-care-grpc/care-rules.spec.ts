import { at, careRequest, makePet } from '../../test/pet.fixture';
import { Attention, CareMistakeReason, DeathCause, PetEventType, Stage } from '../pets/pet-enums';
import { CareRejectedError, CareRules } from './care-rules';

const now = at(10);

function rejectReason(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof CareRejectedError ? error.reason : 'other';
  }
  return undefined;
}

describe('CareRules.applyCare (§8–9)', () => {
  it('кормить голодного: сытость и вес растут, зов HUNGRY закрыт, ошибки нет', () => {
    const hungry = makePet({ hunger: 0, attention: Attention.HUNGRY, attentionSince: at(0) });
    const outcome = CareRules.applyCare(hungry, careRequest('FEED', { hungerDelta: 2, weightDelta: 1 }), now);
    expect(outcome.pet.hunger).toBe(2);
    expect(outcome.pet.weight).toBe(11);
    expect(outcome.pet.attention).toBeNull();
    expect(outcome.mistake).toBe(false);
    expect(outcome.history.map((h) => h.type)).toEqual([PetEventType.CARE]);
    expect(outcome.history[0]).toMatchObject({ details: { type: 'FEED' }, occurredAt: now });
  });

  it('кормить сытого – ошибка ухода', () => {
    const outcome = CareRules.applyCare(
      makePet({ hunger: 4 }),
      careRequest('FEED', { hungerDelta: 1, weightDelta: 1 }),
      now,
    );
    expect(outcome.mistake).toBe(true);
    expect(outcome.pet.careMistakes).toBe(1);
    expect(outcome.pet.hunger).toBe(4);
    expect(outcome.history.find((h) => h.type === PetEventType.CARE_MISTAKE)?.details).toMatchObject({
      reason: CareMistakeReason.OVERFED,
    });
  });

  it('лакомство: настроение +, вес +3; сердечек не больше 4', () => {
    const outcome = CareRules.applyCare(
      makePet({ happiness: 3 }),
      careRequest('SNACK', { happinessDelta: 2, weightDelta: 3 }),
      now,
    );
    expect(outcome.pet.happiness).toBe(4);
    expect(outcome.pet.weight).toBe(13);
    expect(outcome.mistake).toBe(false);
  });

  it('игра: настроение +, вес −1, но не меньше 1; зов UNHAPPY закрыт', () => {
    const sad = makePet({ happiness: 0, weight: 1, attention: Attention.UNHAPPY, attentionSince: at(0) });
    const outcome = CareRules.applyCare(sad, careRequest('PLAY', { happinessDelta: 1, weightDelta: -1 }), now);
    expect(outcome.pet.happiness).toBe(1);
    expect(outcome.pet.weight).toBe(1);
    expect(outcome.pet.attention).toBeNull();
  });

  it('убрать: какашки обнуляются, зов DIRTY закрыт', () => {
    const dirty = makePet({ poopCount: 3, attention: Attention.DIRTY, attentionSince: at(0) });
    const outcome = CareRules.applyCare(dirty, careRequest('CLEAN'), now);
    expect(outcome.pet.poopCount).toBe(0);
    expect(outcome.pet.attention).toBeNull();
  });

  it('лечить больного: болезнь проходит, отсчёт «болен и голоден» сброшен', () => {
    const sick = makePet({
      isSick: true,
      hunger: 0,
      attention: Attention.SICK,
      attentionSince: at(0),
      starvingSince: at(0),
    });
    const outcome = CareRules.applyCare(sick, careRequest('HEAL', { curesSickness: true }), now);
    expect(outcome.pet.isSick).toBe(false);
    expect(outcome.pet.starvingSince).toBeNull();
    // голод остался – зов сменился на HUNGRY, новый эпизод
    expect(outcome.pet.attention).toBe(Attention.HUNGRY);
    expect(outcome.pet.attentionSince).toEqual(now);
    expect(outcome.mistake).toBe(false);
  });

  it('лечить здорового – ошибка ухода', () => {
    const outcome = CareRules.applyCare(makePet(), careRequest('HEAL', { curesSickness: true }), now);
    expect(outcome.mistake).toBe(true);
    expect(outcome.pet.careMistakes).toBe(1);
    expect(outcome.history[1].details).toMatchObject({ reason: CareMistakeReason.NEEDLESS_HEAL });
  });

  it('воспитать капризного: дисциплина +25 (не больше 100), каприз закрыт', () => {
    const naughty = makePet({ discipline: 30, attention: Attention.MISBEHAVING, attentionSince: at(0) });
    const outcome = CareRules.applyCare(naughty, careRequest('SCOLD'), now);
    expect(outcome.pet.discipline).toBe(55);
    expect(outcome.pet.attention).toBeNull();
    expect(outcome.mistake).toBe(false);
    const strict = makePet({ discipline: 90, attention: Attention.MISBEHAVING, attentionSince: at(0) });
    expect(CareRules.applyCare(strict, careRequest('SCOLD'), now).pet.discipline).toBe(100);
  });

  it('ругать без каприза – ошибка, дисциплина не растёт', () => {
    const outcome = CareRules.applyCare(makePet({ discipline: 30 }), careRequest('SCOLD'), now);
    expect(outcome.mistake).toBe(true);
    expect(outcome.pet.discipline).toBe(30);
    expect(outcome.history[1].details).toMatchObject({ reason: CareMistakeReason.NEEDLESS_SCOLD });
  });

  it('свет: выключить – спит, спящего можно только разбудить', () => {
    const asleep = CareRules.applyCare(makePet(), careRequest('LIGHTS_OFF'), now).pet;
    expect(asleep.isSleeping).toBe(true);
    expect(rejectReason(() => CareRules.applyCare(asleep, careRequest('FEED'), now))).toBe('SLEEPING');
    expect(rejectReason(() => CareRules.applyCare(asleep, careRequest('LIGHTS_OFF'), now))).toBe('SLEEPING');
    expect(CareRules.applyCare(asleep, careRequest('LIGHTS_ON'), now).pet.isSleeping).toBe(false);
  });

  it('отказы: яйцо, умер, неизвестное действие', () => {
    expect(rejectReason(() => CareRules.applyCare(makePet({ stage: Stage.EGG }), careRequest('FEED'), now))).toBe(
      'EGG',
    );
    const dead = makePet({ diedAt: at(0), deathCause: DeathCause.NEGLECT });
    expect(rejectReason(() => CareRules.applyCare(dead, careRequest('FEED'), now))).toBe('DEAD');
    expect(rejectReason(() => CareRules.applyCare(makePet(), careRequest('DANCE'), now))).toBe('UNKNOWN_TYPE');
  });

  it('не меняет переданного питомца', () => {
    const pet = makePet({ hunger: 1 });
    CareRules.applyCare(pet, careRequest('FEED', { hungerDelta: 2 }), now);
    expect(pet.hunger).toBe(1);
  });
});
