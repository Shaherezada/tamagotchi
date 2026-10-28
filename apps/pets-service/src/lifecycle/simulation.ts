import {
  createEnvelope,
  type EventEnvelope,
  type PetDied,
  type PetEvolved,
  type PetHungry,
  type PetSick,
  RoutingKey,
} from '@app/contracts';
import { PetEvent } from '../pets/entities/pet-event.entity';
import { PetForm } from '../pets/entities/pet-form.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Attention, CareMistakeReason, DeathCause, NEXT_STAGE, PetEventType, Stage } from '../pets/pet-enums';
import { chooseFormCode, petFormByCode } from '../pets/pet-forms.catalog';
import {
  DIRTY_POOP,
  DISCIPLINE_DECAY,
  DISCIPLINE_DECAY_MINUTES,
  gameDays,
  gameMinutesToMs,
  GameRules,
  MAX_POOP,
  MISBEHAVE_CHANCE,
  POOP_JITTER_MINUTES,
  POOP_MINUTES,
} from './game-rules';

/** Источник случайности; в тестах подменяется детерминированным. */
export type Rng = () => number;

export interface SimulationResult {
  pet: Pet;
  history: PetEvent[];
  events: EventEnvelope[];
}

/** Причина болезни в pet.sick: болезнь бывает только от какашек (§8). */
export const SICK_CAUSE_DIRTY = 'DIRTY';

// защита от бесконечного цикла при ошибке в правилах: столько событий не набирается даже за 10 игровых суток
const MAX_STEPS = 100_000;

/**
 * Чистая функция жизни питомца (§8): не трогает БД, покрывается unit-тестами.
 *
 * Время идёт событиями: падение сытости и настроения – в точках bornAt + k × decayMinutes, дисциплины –
 * bornAt + k × 6 ч, какашки – bornAt + k × 3 ч со сдвигом ± 15 мин, а также срок зова, смерть от
 * запущенности и конец стадии. Все отметки отсчитываются от bornAt, поэтому отдельных счётчиков
 * в БД не нужно, а перемотка – просто сдвиг отметок назад. nextTickAt – время ближайшего события.
 */
export class Simulation {
  static simulate(source: Pet, now: Date, rules: GameRules, rng: Rng): SimulationResult {
    const pet = clonePet(source);
    const result: SimulationResult = { pet, history: [], events: [] };
    if (pet.diedAt) {
      return result;
    }
    let t = pet.simulatedAt.getTime();
    const end = Math.max(now.getTime(), t);
    refreshNeeds(pet, new Date(t));
    for (let steps = 0; !pet.diedAt; steps++) {
      if (steps > MAX_STEPS) {
        throw new Error(`simulate: слишком много событий у питомца ${pet.id}`);
      }
      const next = Math.max(t, nextEventAt(pet, t, rules));
      if (next > end) {
        break;
      }
      step(pet, t, next, rules, rng, result);
      t = next;
    }
    // у умершего время остановилось в момент смерти
    pet.simulatedAt = pet.diedAt ?? new Date(end);
    pet.nextTickAt = pet.diedAt ?? new Date(nextEventAt(pet, end, rules));
    return result;
  }
}

/**
 * Пересчёт зова по текущим показателям (приоритет: болезнь, голод, грязь, грусть; каприз держится,
 * пока его не закрыли «воспитать» или не вытеснила нужда важнее). Новый зов – новый эпизод:
 * отсчёт 15 минут заново и ошибка ещё не засчитана. Здесь же – начало и конец «болен и голоден».
 */
export function refreshNeeds(pet: Pet, at: Date): void {
  let need: Attention | null = null;
  if (pet.isSick) {
    need = Attention.SICK;
  } else if (pet.hunger === 0) {
    need = Attention.HUNGRY;
  } else if (pet.poopCount >= DIRTY_POOP) {
    need = Attention.DIRTY;
  } else if (pet.happiness === 0) {
    need = Attention.UNHAPPY;
  } else if (pet.attention === Attention.MISBEHAVING) {
    need = Attention.MISBEHAVING;
  }
  if (need !== pet.attention) {
    pet.attention = need;
    pet.attentionSince = need ? at : null;
    pet.mistakeCounted = false;
  }
  if (!(pet.isSick && pet.hunger === 0)) {
    pet.starvingSince = null;
  } else if (!pet.starvingSince) {
    pet.starvingSince = at;
  }
}

export function clonePet(source: Pet): Pet {
  return Object.assign(new Pet(), source);
}

export function historyRow(pet: Pet, type: PetEventType, details: object, occurredAt: Date): PetEvent {
  return Object.assign(new PetEvent(), { pet, type, details, occurredAt });
}

/** Ближайшая точка сетки start + k × period строго после t (k ≥ 1). */
function nextGridPoint(start: number, period: number, t: number): number {
  const k = Math.max(1, Math.floor((t - start) / period) + 1);
  return start + k * period;
}

/** Сдвиг k-й какашки в пределах ± jitter: детерминированный по id питомца, чтобы повторный simulate дал то же. */
function poopJitter(petId: string, k: number, jitter: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${petId}:${k}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return Math.round((hash / 0x1_0000_0000) * 2 * jitter - jitter);
}

function nextPoopAt(pet: Pet, t: number, rules: GameRules): number {
  const born = pet.bornAt.getTime();
  const period = gameMinutesToMs(rules, POOP_MINUTES);
  const jitter = gameMinutesToMs(rules, POOP_JITTER_MINUTES);
  for (let k = Math.max(1, Math.floor((t - born) / period)); ; k++) {
    const at = born + k * period + poopJitter(pet.id, k, jitter);
    if (at > t) {
      return at;
    }
  }
}

/** Время ближайшего события после t (или уже просроченного – тогда не раньше t). */
function nextEventAt(pet: Pet, t: number, rules: GameRules): number {
  const born = pet.bornAt.getTime();
  const times = [pet.stageSince.getTime() + gameMinutesToMs(rules, rules.stageMinutes[pet.stage])];
  if (pet.stage !== Stage.EGG) {
    if (!pet.isSleeping) {
      times.push(nextGridPoint(born, gameMinutesToMs(rules, rules.decayMinutes), t));
    }
    times.push(nextGridPoint(born, gameMinutesToMs(rules, DISCIPLINE_DECAY_MINUTES), t));
    times.push(nextPoopAt(pet, t, rules));
  }
  if (pet.attention && pet.attentionSince && !pet.mistakeCounted) {
    times.push(pet.attentionSince.getTime() + gameMinutesToMs(rules, rules.callMinutes));
  }
  if (pet.starvingSince) {
    times.push(pet.starvingSince.getTime() + gameMinutesToMs(rules, rules.neglectHours * 60));
  }
  return Math.min(...times);
}

/** Все события в момент t (prev – предыдущий обработанный момент). */
function step(pet: Pet, prev: number, t: number, rules: GameRules, rng: Rng, out: SimulationResult): void {
  const at = new Date(t);
  const born = pet.bornAt.getTime();
  const decayPoint =
    pet.stage !== Stage.EGG && nextGridPoint(born, gameMinutesToMs(rules, rules.decayMinutes), prev) === t;
  if (pet.stage !== Stage.EGG) {
    if (decayPoint && !pet.isSleeping) {
      decayHearts(pet, at, out);
    }
    if (nextGridPoint(born, gameMinutesToMs(rules, DISCIPLINE_DECAY_MINUTES), prev) === t) {
      pet.discipline = Math.max(0, pet.discipline - DISCIPLINE_DECAY);
    }
    if (nextPoopAt(pet, prev, rules) === t) {
      poop(pet, at, out);
    }
  }
  refreshNeeds(pet, at);
  if (decayPoint && !pet.isSleeping && pet.attention === null && rng() < MISBEHAVE_CHANCE) {
    pet.attention = Attention.MISBEHAVING;
    pet.attentionSince = at;
    pet.mistakeCounted = false;
    out.history.push(historyRow(pet, PetEventType.MISBEHAVING, {}, at));
  }
  if (
    pet.attention &&
    pet.attentionSince &&
    !pet.mistakeCounted &&
    pet.attentionSince.getTime() + gameMinutesToMs(rules, rules.callMinutes) <= t
  ) {
    pet.mistakeCounted = true;
    pet.careMistakes += 1;
    out.history.push(
      historyRow(
        pet,
        PetEventType.CARE_MISTAKE,
        { reason: CareMistakeReason.IGNORED_CALL, attention: pet.attention },
        at,
      ),
    );
  }
  if (pet.starvingSince && pet.starvingSince.getTime() + gameMinutesToMs(rules, rules.neglectHours * 60) <= t) {
    die(pet, DeathCause.NEGLECT, at, rules, out);
    return;
  }
  if (pet.stageSince.getTime() + gameMinutesToMs(rules, rules.stageMinutes[pet.stage]) <= t) {
    const next = NEXT_STAGE[pet.stage];
    if (next) {
      evolve(pet, next, at, out);
    } else {
      die(pet, DeathCause.OLD_AGE, at, rules, out);
    }
  }
}

function decayHearts(pet: Pet, at: Date, out: SimulationResult): void {
  if (pet.hunger > 0) {
    pet.hunger -= 1;
    if (pet.hunger === 0) {
      out.history.push(historyRow(pet, PetEventType.HUNGRY, {}, at));
      out.events.push(
        createEnvelope<PetHungry>(RoutingKey.PetHungry, { ...eventBase(pet), since: at.toISOString() }, at),
      );
    }
  }
  if (pet.happiness > 0) {
    pet.happiness -= 1;
    if (pet.happiness === 0) {
      out.history.push(historyRow(pet, PetEventType.UNHAPPY, {}, at));
    }
  }
}

function poop(pet: Pet, at: Date, out: SimulationResult): void {
  if (pet.poopCount < MAX_POOP) {
    pet.poopCount += 1;
    if (pet.poopCount === DIRTY_POOP) {
      out.history.push(historyRow(pet, PetEventType.DIRTY, { poopCount: pet.poopCount }, at));
    }
  }
  if (pet.poopCount >= MAX_POOP && !pet.isSick) {
    pet.isSick = true;
    out.history.push(historyRow(pet, PetEventType.SICK, { cause: SICK_CAUSE_DIRTY }, at));
    out.events.push(createEnvelope<PetSick>(RoutingKey.PetSick, { ...eventBase(pet), cause: SICK_CAUSE_DIRTY }, at));
  }
}

function evolve(pet: Pet, toStage: Stage, at: Date, out: SimulationResult): void {
  const fromStage = pet.stage;
  const formCode = chooseFormCode(toStage, pet.careMistakes, pet.discipline);
  pet.stage = toStage;
  pet.form = Object.assign(new PetForm(), petFormByCode(formCode));
  pet.stageSince = at;
  out.history.push(historyRow(pet, PetEventType.EVOLVED, { fromStage, toStage, formCode }, at));
  out.events.push(
    createEnvelope<PetEvolved>(
      RoutingKey.PetEvolved,
      { ...eventBase(pet), fromStage, toStage, formCode, careMistakes: pet.careMistakes },
      at,
    ),
  );
}

function die(pet: Pet, cause: DeathCause, at: Date, rules: GameRules, out: SimulationResult): void {
  const ageDays = gameDays(rules, at.getTime() - pet.bornAt.getTime());
  pet.diedAt = at;
  pet.deathCause = cause;
  pet.isSleeping = false;
  pet.attention = null;
  pet.attentionSince = null;
  pet.mistakeCounted = false;
  pet.starvingSince = null;
  out.history.push(historyRow(pet, PetEventType.DIED, { cause, ageDays }, at));
  out.events.push(createEnvelope<PetDied>(RoutingKey.PetDied, { ...eventBase(pet), cause, ageDays }, at));
}

function eventBase(pet: Pet): { petId: string; ownerId: string; petName: string } {
  return { petId: pet.id, ownerId: pet.ownerId, petName: pet.name };
}
