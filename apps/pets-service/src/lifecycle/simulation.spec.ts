import { RoutingKey } from '@app/contracts';
import { at, calm, careRequest, makePet, naughty, rules, T0 } from '../../test/pet.fixture';
import { CareRules } from '../pet-care-grpc/care-rules';
import type { Pet } from '../pets/entities/pet.entity';
import { Attention, CareMistakeReason, DeathCause, PetEventType, Stage } from '../pets/pet-enums';
import { chooseFormCode } from '../pets/pet-forms.catalog';
import { Simulation, SICK_CAUSE_DIRTY, type SimulationResult } from './simulation';

function live(pet: Pet, minutes: number, rng = calm, speed = 1): SimulationResult {
  return Simulation.simulate(pet, at(minutes), rules(speed), rng);
}

const types = (result: SimulationResult): string[] => result.history.map((h) => h.type);
const keys = (result: SimulationResult): string[] => result.events.map((e) => e.type);

describe('Simulation.simulate (§8)', () => {
  describe('сытость и настроение: −1 каждые 30 мин, во сне не падают', () => {
    it('до первой отметки ничего не меняется', () => {
      const { pet } = live(makePet(), 29);
      expect([pet.hunger, pet.happiness]).toEqual([4, 4]);
    });

    it('каждые 30 минут – минус сердечко', () => {
      expect([live(makePet(), 30).pet.hunger, live(makePet(), 30).pet.happiness]).toEqual([3, 3]);
      expect([live(makePet(), 90).pet.hunger, live(makePet(), 90).pet.happiness]).toEqual([1, 1]);
    });

    it('ниже нуля не опускаются', () => {
      const { pet } = live(makePet(), 600);
      expect([pet.hunger, pet.happiness]).toEqual([0, 0]);
    });

    it('сытость 0 – зов HUNGRY, хронология и событие pet.hungry', () => {
      const result = live(makePet(), 120);
      expect(result.pet.attention).toBe(Attention.HUNGRY);
      expect(result.pet.attentionSince).toEqual(at(120));
      expect(types(result)).toEqual([PetEventType.HUNGRY, PetEventType.UNHAPPY]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        type: RoutingKey.PetHungry,
        occurredAt: at(120).toISOString(),
        payload: { petId: makePet().id, ownerId: makePet().ownerId, petName: 'Пушок', since: at(120).toISOString() },
      });
    });

    it('настроение 0 при сытости – зов UNHAPPY', () => {
      const { pet } = live(makePet({ hunger: 4, happiness: 1 }), 30);
      expect(pet.attention).toBe(Attention.UNHAPPY);
    });

    it('во сне сытость и настроение не падают', () => {
      const { pet } = live(makePet({ isSleeping: true }), 600);
      expect([pet.hunger, pet.happiness]).toEqual([4, 4]);
    });
  });

  describe('дисциплина: −5 каждые 6 ч', () => {
    it('падает в отметки 6 и 12 ч и не ниже нуля', () => {
      expect(live(makePet({ discipline: 50 }), 359).pet.discipline).toBe(50);
      expect(live(makePet({ discipline: 50 }), 360).pet.discipline).toBe(45);
      expect(live(makePet({ discipline: 50 }), 720).pet.discipline).toBe(40);
      expect(live(makePet({ discipline: 3 }), 360).pet.discipline).toBe(0);
    });

    it('падает и во сне', () => {
      expect(live(makePet({ discipline: 50, isSleeping: true }), 360).pet.discipline).toBe(45);
    });
  });

  describe('какашки: +1 каждые 3 ч ± 15 мин, при 4 – болезнь', () => {
    it('первая – в окне 2:45–3:15', () => {
      expect(live(makePet(), 164).pet.poopCount).toBe(0);
      expect(live(makePet(), 196).pet.poopCount).toBe(1);
    });

    it('три – зов DIRTY, если нет нужды важнее', () => {
      const result = live(makePet({ isSleeping: true }), 556);
      expect(result.pet.poopCount).toBe(3);
      expect(result.pet.attention).toBe(Attention.DIRTY);
      expect(types(result)).toContain(PetEventType.DIRTY);
    });

    it('четыре – болезнь, зов SICK и событие pet.sick', () => {
      const result = live(makePet({ isSleeping: true }), 736);
      expect(result.pet.poopCount).toBe(4);
      expect(result.pet.isSick).toBe(true);
      expect(result.pet.attention).toBe(Attention.SICK);
      expect(types(result)).toContain(PetEventType.SICK);
      expect(result.events.find((e) => e.type === RoutingKey.PetSick)?.payload).toMatchObject({
        cause: SICK_CAUSE_DIRTY,
      });
    });

    it('больше четырёх не копится; вылеченный снова заболевает при следующей какашке', () => {
      const pet = makePet({ isSleeping: true, poopCount: 4 });
      const result = live(pet, 196);
      expect(result.pet.poopCount).toBe(4);
      expect(result.pet.isSick).toBe(true);
    });

    it('сдвиг детерминирован: тот же питомец – тот же момент', () => {
      const first = live(makePet({ isSleeping: true }), 200).pet.nextTickAt;
      const second = live(makePet({ isSleeping: true }), 200).pet.nextTickAt;
      expect(first).toEqual(second);
    });

    it('у яйца нет ни какашек, ни падения показателей', () => {
      const egg = makePet({ stage: Stage.EGG, stageSince: at(-10_000) });
      const { pet } = Simulation.simulate(egg, at(0), rules(), calm);
      expect([pet.hunger, pet.poopCount]).toEqual([4, 0]);
    });
  });

  describe('зов и ошибки ухода', () => {
    it('зов не закрыт за 15 мин – одна ошибка на эпизод', () => {
      const pet = makePet({ hunger: 0 });
      expect(live(pet, 14).pet.careMistakes).toBe(0);
      const late = live(pet, 15);
      expect(late.pet.careMistakes).toBe(1);
      expect(late.pet.mistakeCounted).toBe(true);
      expect(late.history.find((h) => h.type === PetEventType.CARE_MISTAKE)?.details).toEqual({
        reason: CareMistakeReason.IGNORED_CALL,
        attention: Attention.HUNGRY,
      });
      expect(live(pet, 29).pet.careMistakes).toBe(1);
    });

    it('закрытый и снова открытый зов – новый эпизод и новая ошибка', () => {
      const ignored = live(makePet({ hunger: 0 }), 20).pet;
      const fed = CareRules.applyCare(ignored, careRequest('FEED', { hungerDelta: 1 }), at(20)).pet;
      expect(fed.attention).toBeNull();
      // в 30 мин сытость снова 0, ошибка – в 45 мин
      expect(live(fed, 44).pet.careMistakes).toBe(1);
      expect(live(fed, 45).pet.careMistakes).toBe(2);
    });

    it('зов важнее вытесняет менее важный: болезнь главнее голода', () => {
      const { pet } = live(makePet({ hunger: 0, isSick: true }), 1);
      expect(pet.attention).toBe(Attention.SICK);
    });

    it('каприз MISBEHAVING иногда (Rng) в отметку падения, если питомец спокоен', () => {
      const result = live(makePet(), 30, naughty);
      expect(result.pet.attention).toBe(Attention.MISBEHAVING);
      expect(result.pet.attentionSince).toEqual(at(30));
      expect(types(result)).toContain(PetEventType.MISBEHAVING);
      expect(live(makePet(), 44, naughty).pet.careMistakes).toBe(0);
      expect(live(makePet(), 45, naughty).pet.careMistakes).toBe(1);
    });

    it('без выпавшего случая капризов нет', () => {
      expect(live(makePet(), 60, calm).pet.attention).toBeNull();
    });

    it('во сне и при другой нужде капризов нет', () => {
      expect(live(makePet({ isSleeping: true }), 60, naughty).pet.attention).toBeNull();
      expect(live(makePet({ hunger: 1 }), 30, naughty).pet.attention).toBe(Attention.HUNGRY);
    });
  });

  describe('смерть', () => {
    it('болен и голоден 12 ч без перерыва – NEGLECT и pet.died', () => {
      const pet = makePet({ hunger: 0, isSick: true });
      expect(live(pet, 719).pet.diedAt).toBeNull();
      const result = live(pet, 720);
      expect(result.pet.diedAt).toEqual(at(720));
      expect(result.pet.deathCause).toBe(DeathCause.NEGLECT);
      expect(result.pet.attention).toBeNull();
      expect(types(result)).toContain(PetEventType.DIED);
      const died = result.events.find((e) => e.type === RoutingKey.PetDied);
      expect(died?.payload).toMatchObject({ cause: DeathCause.NEGLECT, ageDays: 0 });
      expect(died?.occurredAt).toBe(at(720).toISOString());
    });

    it('перерыв в голоде сбрасывает отсчёт', () => {
      const starving = live(makePet({ hunger: 0, isSick: true }), 600).pet;
      const fed = CareRules.applyCare(starving, careRequest('FEED', { hungerDelta: 1 }), at(600)).pet;
      expect(fed.starvingSince).toBeNull();
      // в 630 сытость снова 0: смерть через 12 ч – в 1350
      expect(live(fed, 1349).pet.diedAt).toBeNull();
      expect(live(fed, 1350).pet.deathCause).toBe(DeathCause.NEGLECT);
    });

    it('конец стадии ELDER – OLD_AGE', () => {
      const elder = makePet({ stage: Stage.ELDER, bornAt: at(-153 * 60), stageSince: at(-48 * 60 + 10) });
      expect(live(elder, 9).pet.diedAt).toBeNull();
      const result = live(elder, 10);
      expect(result.pet.diedAt).toEqual(at(10));
      expect(result.pet.deathCause).toBe(DeathCause.OLD_AGE);
      expect(result.events.map((e) => e.payload)).toContainEqual(
        expect.objectContaining({ cause: DeathCause.OLD_AGE, ageDays: 6 }),
      );
    });

    it('мёртвый питомец не меняется', () => {
      const dead = makePet({ diedAt: T0, deathCause: DeathCause.OLD_AGE });
      const result = live(dead, 10_000);
      expect(result.pet).toEqual(dead);
      expect(result.history).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('после смерти события не происходят', () => {
      const result = live(makePet({ hunger: 0, isSick: true }), 5000);
      expect(result.pet.diedAt).toEqual(at(720));
      expect(keys(result).filter((k) => k === RoutingKey.PetDied)).toHaveLength(1);
      expect(result.history.at(-1)?.type).toBe(PetEventType.DIED);
    });
  });

  describe('стадии: EGG 5 мин → BABY 1 ч → CHILD 8 ч → TEEN 24 ч → ADULT 72 ч → ELDER', () => {
    it.each([
      [Stage.EGG, 5, Stage.BABY, 'baby'],
      [Stage.BABY, 60, Stage.CHILD, 'child_good'],
      [Stage.CHILD, 8 * 60, Stage.TEEN, 'teen_good'],
      [Stage.TEEN, 24 * 60, Stage.ADULT, 'adult_good'],
      [Stage.ADULT, 72 * 60, Stage.ELDER, 'elder'],
    ])('%s через %i мин → %s (%s), pet.evolved', (from, minutes, to, formCode) => {
      const pet = makePet({ stage: from, stageSince: at(1 - minutes) });
      expect(live(pet, 0).pet.stage).toBe(from);
      const result = live(pet, 1);
      expect(result.pet.stage).toBe(to);
      expect(result.pet.stageSince).toEqual(at(1));
      expect(result.pet.form.code).toBe(formCode);
      expect(result.history.find((h) => h.type === PetEventType.EVOLVED)?.details).toEqual({
        fromStage: from,
        toStage: to,
        formCode,
      });
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        type: RoutingKey.PetEvolved,
        payload: { petId: pet.id, ownerId: pet.ownerId, petName: pet.name, fromStage: from, toStage: to, formCode },
      });
    });

    it('новое яйцо вылупляется через 5 игровых минут', () => {
      const egg = makePet({ stage: Stage.EGG });
      expect(live(egg, 4).pet.stage).toBe(Stage.EGG);
      expect(live(egg, 5).pet.stage).toBe(Stage.BABY);
    });

    it('GAME_SPEED ускоряет время: при 60 яйцо вылупляется за 5 секунд', () => {
      const egg = makePet({ stage: Stage.EGG });
      const fast = rules(60);
      expect(Simulation.simulate(egg, new Date(T0.getTime() + 4_999), fast, calm).pet.stage).toBe(Stage.EGG);
      expect(Simulation.simulate(egg, new Date(T0.getTime() + 5_000), fast, calm).pet.stage).toBe(Stage.BABY);
    });
  });

  describe('форма при переходе: < 2 ошибок – good, 2–4 – normal, 5+ – bad; adult_star – ещё дисциплина ≥ 50', () => {
    it.each([
      [Stage.CHILD, 0, 0, 'child_good'],
      [Stage.CHILD, 1, 0, 'child_good'],
      [Stage.CHILD, 2, 0, 'child_normal'],
      [Stage.CHILD, 4, 0, 'child_normal'],
      [Stage.CHILD, 5, 0, 'child_bad'],
      [Stage.TEEN, 1, 0, 'teen_good'],
      [Stage.TEEN, 3, 0, 'teen_normal'],
      [Stage.TEEN, 7, 0, 'teen_bad'],
      [Stage.ADULT, 1, 50, 'adult_star'],
      [Stage.ADULT, 1, 49, 'adult_good'],
      [Stage.ADULT, 2, 100, 'adult_normal'],
      [Stage.ADULT, 5, 100, 'adult_bad'],
      [Stage.BABY, 9, 0, 'baby'],
      [Stage.ELDER, 9, 0, 'elder'],
    ])('%s, ошибок %i, дисциплина %i → %s', (stage, mistakes, discipline, code) => {
      expect(chooseFormCode(stage, mistakes, discipline)).toBe(code);
    });

    it('при переходе форма считается по ошибкам и дисциплине питомца, careMistakes – в pet.evolved', () => {
      const teen = (careMistakes: number, discipline: number): Pet =>
        makePet({ stage: Stage.TEEN, stageSince: at(1 - 24 * 60), careMistakes, discipline });
      expect(live(teen(0, 60), 1).pet.form.code).toBe('adult_star');
      expect(live(teen(3, 60), 1).pet.form.code).toBe('adult_normal');
      const bad = live(teen(5, 60), 1);
      expect(bad.pet.form.code).toBe('adult_bad');
      expect(bad.events[0].payload).toMatchObject({ formCode: 'adult_bad', careMistakes: 5 });
    });
  });

  describe('чистота и планирование', () => {
    it('не меняет переданного питомца', () => {
      const pet = makePet();
      live(pet, 600);
      expect(pet).toEqual(makePet());
    });

    it('simulatedAt – now, nextTickAt – ближайшее событие', () => {
      expect(live(makePet(), 0).pet.nextTickAt).toEqual(at(30));
      expect(live(makePet(), 31).pet.simulatedAt).toEqual(at(31));
      expect(live(makePet({ stage: Stage.EGG }), 0).pet.nextTickAt).toEqual(at(5));
      expect(live(makePet({ hunger: 0 }), 0).pet.nextTickAt).toEqual(at(15));
      const sleeping = live(makePet({ isSleeping: true }), 0).pet.nextTickAt.getTime();
      expect(sleeping).toBeGreaterThanOrEqual(at(165).getTime());
      expect(sleeping).toBeLessThanOrEqual(at(195).getTime());
    });

    it('много коротких тиков дают то же, что один длинный', () => {
      const once = live(makePet({ stage: Stage.CHILD }), 1500).pet;
      let stepwise = makePet({ stage: Stage.CHILD });
      for (let minute = 7; minute <= 1500; minute += 7) {
        stepwise = live(stepwise, minute).pet;
      }
      stepwise = live(stepwise, 1500).pet;
      expect(stepwise).toEqual(once);
    });

    it('время назад не идёт', () => {
      const pet = makePet({ simulatedAt: at(100) });
      expect(live(pet, 50).pet.simulatedAt).toEqual(at(100));
    });
  });
});
