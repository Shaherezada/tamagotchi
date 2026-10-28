import { ProblemException } from '@app/common';
import type { PetSnapshot } from '@app/contracts';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { careFixture, PLAYER } from '../../test/care-fixtures';
import { Reason } from '../wallet/reason.enum';
import { CareAction } from './care-action.entity';
import { CareActionsService, MAX_CARE_ATTEMPTS, PLAY_REWARD_COINS } from './care-actions.service';
import { CareStatus, CareType } from './care-enums';
import type { PetCareClient } from './pet-care.client';

const PET = '5f2b8c1d-7e3a-4b6c-9d0e-1a2b3c4d5e6f';

function snapshot(patch: Partial<PetSnapshot> = {}): PetSnapshot {
  return {
    petId: PET,
    name: 'Пушок',
    stage: 'CHILD',
    formCode: 'child_good',
    hunger: 3,
    happiness: 2,
    discipline: 50,
    weight: 11,
    poopCount: 0,
    isSick: false,
    isSleeping: false,
    careMistakes: 0,
    careMistakeMade: false,
    ...patch,
  };
}

/** Ошибка в том виде, в каком её отдаёт клиент @grpc/grpc-js. */
function grpcError(code: GrpcStatus, details = ''): Error {
  return Object.assign(new Error(`${code} ${details}`), { code, details });
}

describe('CareActionsService', () => {
  function setup() {
    const care = careFixture();
    const pets = { apply: jest.fn(), snapshot: jest.fn() };
    const service = new CareActionsService(
      care.db.dataSource,
      care.inventory,
      care.wallet,
      pets as unknown as PetCareClient,
    );
    const actions = () => care.db.rows(CareAction);
    return { ...care, pets, service, actions };
  }

  describe('perform – сага ухода', () => {
    it('уход принят: предмет списан, действие APPLIED, эффект предмета ушёл в gRPC', async () => {
      const { service, pets, items, actions, ...care } = setup();
      care.giveItem(PLAYER, 'fish', 2);
      pets.apply.mockResolvedValue(snapshot({ hunger: 4 }));

      const result = await service.perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.fish.id });

      expect(result.pet.hunger).toBe(4);
      expect(result.action).toMatchObject({
        petId: PET,
        type: CareType.FEED,
        itemId: items.fish.id,
        status: CareStatus.APPLIED,
      });
      expect(pets.apply).toHaveBeenCalledWith({
        actionId: result.action.id,
        petId: PET,
        ownerId: PLAYER,
        type: CareType.FEED,
        hungerDelta: 2,
        happinessDelta: 0,
        weightDelta: 1,
        curesSickness: false,
      });
      expect(care.quantity(PLAYER, 'fish')).toBe(1);
      expect(actions()).toEqual([
        expect.objectContaining({ status: CareStatus.APPLIED, attempts: 1, result: snapshot({ hunger: 4 }) }),
      ]);
    });

    it('отказ (питомец спит): 409, предмет возвращён, действие REJECTED с причиной', async () => {
      const { service, pets, items, actions, ...care } = setup();
      care.giveItem(PLAYER, 'rice', 1);
      pets.apply.mockRejectedValue(grpcError(GrpcStatus.FAILED_PRECONDITION, 'PET_SLEEPING'));

      const error = await service
        .perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.rice.id })
        .catch((e: unknown) => e);

      expect((error as ProblemException).problem).toMatchObject({
        status: 409,
        type: expect.stringMatching(/care-rejected$/),
      });
      expect(care.quantity(PLAYER, 'rice')).toBe(1);
      expect(actions()).toEqual([
        expect.objectContaining({
          status: CareStatus.REJECTED,
          rejectReason: 'PET_SLEEPING',
          completedAt: expect.any(Date),
        }),
      ]);
    });

    it('pets-service отклонил запрос (INVALID_ARGUMENT): 400, предмет возвращён, REJECTED без повторов', async () => {
      const { service, pets, items, actions, ...care } = setup();
      care.giveItem(PLAYER, 'rice', 1);
      pets.apply.mockRejectedValue(grpcError(GrpcStatus.INVALID_ARGUMENT, 'Неизвестное действие'));

      const error = await service
        .perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.rice.id })
        .catch((e: unknown) => e);

      expect((error as ProblemException).problem).toMatchObject({
        status: 400,
        type: expect.stringMatching(/care-invalid$/),
      });
      expect(care.quantity(PLAYER, 'rice')).toBe(1);
      expect(actions()).toEqual([
        expect.objectContaining({ status: CareStatus.REJECTED, rejectReason: 'INVALID_CARE_REQUEST', attempts: 1 }),
      ]);
      expect(pets.apply).toHaveBeenCalledTimes(1);
    });

    it('чужой или несуществующий питомец: 404 и возврат предмета', async () => {
      const { service, pets, items, actions, ...care } = setup();
      care.giveItem(PLAYER, 'pill', 1);
      pets.apply.mockRejectedValue(grpcError(GrpcStatus.NOT_FOUND));

      await expect(
        service.perform(PLAYER, { petId: PET, type: CareType.HEAL, itemId: items.pill.id }),
      ).rejects.toMatchObject({
        problem: { status: 404 },
      });
      expect(care.quantity(PLAYER, 'pill')).toBe(1);
      expect(actions()[0]).toMatchObject({ status: CareStatus.REJECTED, rejectReason: 'PET_NOT_FOUND' });
    });

    it('pets-service недоступен: 503, действие осталось PENDING, предмет списан до досылки', async () => {
      const { service, pets, items, actions, ...care } = setup();
      care.giveItem(PLAYER, 'candy', 2);
      pets.apply.mockRejectedValue(grpcError(GrpcStatus.UNAVAILABLE, 'No connection established'));

      await expect(
        service.perform(PLAYER, { petId: PET, type: CareType.SNACK, itemId: items.candy.id }),
      ).rejects.toMatchObject({ problem: { status: 503 } });
      expect(care.quantity(PLAYER, 'candy')).toBe(1);
      expect(actions()).toEqual([
        expect.objectContaining({ status: CareStatus.PENDING, attempts: 1, completedAt: null }),
      ]);
    });

    it('предмета нет в инвентаре: 409, действие не создано, pets-service не вызван', async () => {
      const { service, pets, items, actions } = setup();

      await expect(
        service.perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.rice.id }),
      ).rejects.toMatchObject({
        problem: { status: 409, type: expect.stringMatching(/item-not-in-inventory$/) },
      });
      expect(actions()).toEqual([]);
      expect(pets.apply).not.toHaveBeenCalled();
    });

    it('предмет другой категории: 409; действие с предметом без itemId – 400', async () => {
      const { service, items, ...care } = setup();
      care.giveItem(PLAYER, 'candy', 1);

      await expect(
        service.perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.candy.id }),
      ).rejects.toMatchObject({
        problem: { status: 409, type: expect.stringMatching(/item-not-suitable$/) },
      });
      await expect(service.perform(PLAYER, { petId: PET, type: CareType.HEAL })).rejects.toMatchObject({
        problem: { status: 400 },
      });
      expect(care.quantity(PLAYER, 'candy')).toBe(1);
    });

    it('уборка – без предмета и без инвентаря', async () => {
      const { service, pets } = setup();
      pets.apply.mockResolvedValue(snapshot({ poopCount: 0 }));

      const result = await service.perform(PLAYER, { petId: PET, type: CareType.CLEAN });

      expect(result.action).toMatchObject({ itemId: null, status: CareStatus.APPLIED });
      expect(pets.apply).toHaveBeenCalledWith(
        expect.objectContaining({ type: CareType.CLEAN, hungerDelta: 0, happinessDelta: 0 }),
      );
    });

    it('игра: игрушка не тратится, 5 монет только если настроение выросло', async () => {
      const { service, pets, items, ...care } = setup();
      care.giveItem(PLAYER, 'ball', 1);
      care.giveCoins(PLAYER, 10);
      pets.snapshot.mockResolvedValueOnce(snapshot({ happiness: 2 })).mockResolvedValueOnce(snapshot({ happiness: 4 }));
      pets.apply.mockResolvedValueOnce(snapshot({ happiness: 3 })).mockResolvedValueOnce(snapshot({ happiness: 4 }));

      await service.perform(PLAYER, { petId: PET, type: CareType.PLAY, itemId: items.ball.id });
      await service.perform(PLAYER, { petId: PET, type: CareType.PLAY, itemId: items.ball.id });

      expect(care.quantity(PLAYER, 'ball')).toBe(1);
      expect(care.balance(PLAYER)).toBe(10 + PLAY_REWARD_COINS);
      expect(care.journal(PLAYER)).toEqual([
        expect.objectContaining({ amount: PLAY_REWARD_COINS, reason: Reason.PLAY_REWARD }),
      ]);
    });

    it('игра без игрушки в инвентаре – 409', async () => {
      const { service, items } = setup();

      await expect(
        service.perform(PLAYER, { petId: PET, type: CareType.PLAY, itemId: items.teddy.id }),
      ).rejects.toMatchObject({
        problem: { status: 409 },
      });
    });
  });

  describe('retry – досылка', () => {
    async function pendingAction(setupResult: ReturnType<typeof setup>, attempts = 1) {
      const { service, pets, items, actions, ...care } = setupResult;
      care.giveItem(PLAYER, 'rice', 1);
      pets.apply.mockRejectedValueOnce(grpcError(GrpcStatus.DEADLINE_EXCEEDED));
      await service.perform(PLAYER, { petId: PET, type: CareType.FEED, itemId: items.rice.id }).catch(() => undefined);
      const action = actions()[0];
      action.attempts = attempts;
      return action;
    }

    it('pets-service ожил: тот же actionId, действие APPLIED', async () => {
      const s = setup();
      const action = await pendingAction(s);
      s.pets.apply.mockResolvedValue(snapshot({ hunger: 4 }));

      await s.service.retry(action);

      expect(s.pets.apply).toHaveBeenLastCalledWith(expect.objectContaining({ actionId: action.id, hungerDelta: 1 }));
      expect(s.actions()[0]).toMatchObject({
        status: CareStatus.APPLIED,
        attempts: 2,
        result: snapshot({ hunger: 4 }),
      });
      expect(s.quantity(PLAYER, 'rice')).toBe(0);
    });

    it('снова недоступен – остаётся PENDING, попытка засчитана', async () => {
      const s = setup();
      const action = await pendingAction(s);
      s.pets.apply.mockRejectedValue(grpcError(GrpcStatus.UNAVAILABLE));

      await s.service.retry(action);

      expect(s.actions()[0]).toMatchObject({ status: CareStatus.PENDING, attempts: 2 });
      expect(s.quantity(PLAYER, 'rice')).toBe(0);
    });

    it(`после ${MAX_CARE_ATTEMPTS} попыток без ответа – REJECTED и предмет возвращён`, async () => {
      const s = setup();
      const action = await pendingAction(s, MAX_CARE_ATTEMPTS - 1);
      s.pets.apply.mockRejectedValue(grpcError(GrpcStatus.UNAVAILABLE));

      await s.service.retry(action);

      expect(s.actions()[0]).toMatchObject({
        status: CareStatus.REJECTED,
        attempts: MAX_CARE_ATTEMPTS,
        rejectReason: 'PETS_UNAVAILABLE',
      });
      expect(s.quantity(PLAYER, 'rice')).toBe(1);
    });

    it('отказ при досылке – компенсация', async () => {
      const s = setup();
      const action = await pendingAction(s);
      s.pets.apply.mockRejectedValue(grpcError(GrpcStatus.FAILED_PRECONDITION, 'PET_DEAD'));

      await s.service.retry(action);

      expect(s.actions()[0]).toMatchObject({ status: CareStatus.REJECTED, rejectReason: 'PET_DEAD' });
      expect(s.quantity(PLAYER, 'rice')).toBe(1);
    });

    it('уже завершённое действие не трогается и pets-service не вызывается', async () => {
      const s = setup();
      const action = await pendingAction(s);
      s.actions()[0].status = CareStatus.APPLIED;
      s.pets.apply.mockClear();

      await s.service.retry(action);

      expect(s.pets.apply).not.toHaveBeenCalled();
      expect(s.actions()[0].attempts).toBe(1);
    });
  });

  describe('list', () => {
    it('чужой питомец – 404; недоступный pets-service проверку пропускает', async () => {
      const { service, pets } = setup();
      pets.snapshot.mockRejectedValueOnce(grpcError(GrpcStatus.NOT_FOUND));
      await expect(service.list(PLAYER, { petId: PET, limit: 20 })).rejects.toMatchObject({ problem: { status: 404 } });

      pets.snapshot.mockRejectedValueOnce(grpcError(GrpcStatus.UNAVAILABLE));
      await expect(service.list(PLAYER, { petId: PET, limit: 20 })).resolves.toEqual([]);
    });
  });
});
