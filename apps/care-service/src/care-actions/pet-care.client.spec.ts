import type { PetCare, PetSnapshot } from '@app/contracts';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PetCareClient, toPetCareRejection } from './pet-care.client';

const grpcError = (code: GrpcStatus, details = '') => Object.assign(new Error(details), { code, details });

function client(applyCareAction: jest.Mock): PetCareClient {
  const pets = { applyCareAction, getPetSnapshot: jest.fn() } as unknown as PetCare;
  const instance = new PetCareClient({ getService: () => pets } as unknown as ClientGrpc);
  instance.onModuleInit();
  return instance;
}

const request = {
  actionId: 'a1',
  petId: 'p1',
  ownerId: 'u1',
  type: 'FEED',
  hungerDelta: 1,
  happinessDelta: 0,
  weightDelta: 1,
  curesSickness: false,
};

describe('PetCareClient', () => {
  it('UNAVAILABLE повторяется дважды с тем же запросом, затем ошибка', async () => {
    const apply = jest.fn(() => throwError(() => grpcError(GrpcStatus.UNAVAILABLE)));

    await expect(client(apply).apply(request)).rejects.toMatchObject({ code: GrpcStatus.UNAVAILABLE });
    expect(apply).toHaveBeenCalledTimes(3);
    expect(apply.mock.calls.every(([r]) => r === request)).toBe(true);
  });

  it.each([GrpcStatus.NOT_FOUND, GrpcStatus.FAILED_PRECONDITION, GrpcStatus.INVALID_ARGUMENT])(
    'код %i – окончательный ответ, без повторов',
    async (code) => {
      const apply = jest.fn(() => throwError(() => grpcError(code, 'PET_SLEEPING')));

      await expect(client(apply).apply(request)).rejects.toMatchObject({ code });
      expect(apply).toHaveBeenCalledTimes(1);
    },
  );

  it('после сбоя второй попытки отдаёт ответ pets-service', async () => {
    const pet = { petId: 'p1', hunger: 4 } as PetSnapshot;
    const apply = jest
      .fn()
      .mockReturnValueOnce(throwError(() => grpcError(GrpcStatus.DEADLINE_EXCEEDED)))
      .mockReturnValueOnce(of(pet));

    await expect(client(apply).apply(request)).resolves.toBe(pet);
  });
});

describe('toPetCareRejection', () => {
  it('коды gRPC → 404 / 409 / 400 / недоступен', () => {
    expect(toPetCareRejection(grpcError(GrpcStatus.NOT_FOUND))).toMatchObject({
      status: HttpStatus.NOT_FOUND,
      reason: 'PET_NOT_FOUND',
    });
    expect(toPetCareRejection(grpcError(GrpcStatus.FAILED_PRECONDITION, 'PET_SLEEPING'))).toMatchObject({
      status: HttpStatus.CONFLICT,
      reason: 'PET_SLEEPING',
    });
    expect(toPetCareRejection(grpcError(GrpcStatus.FAILED_PRECONDITION, 'Питомец спит'))).toMatchObject({
      status: HttpStatus.CONFLICT,
      reason: 'PET_UNAVAILABLE',
      detail: 'Питомец спит',
    });
    expect(toPetCareRejection(grpcError(GrpcStatus.INVALID_ARGUMENT, 'actionId должен быть UUID'))).toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      reason: 'INVALID_CARE_REQUEST',
      detail: 'actionId должен быть UUID',
    });
    expect(toPetCareRejection(grpcError(GrpcStatus.UNAVAILABLE))).toBeNull();
    expect(toPetCareRejection(new Error('Execution timed out'))).toBeNull();
  });
});
