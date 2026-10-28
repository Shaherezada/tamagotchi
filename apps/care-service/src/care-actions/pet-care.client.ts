import { type ApplyCareActionRequest, PET_CARE_SERVICE, type PetCare, type PetSnapshot } from '@app/contracts';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleWhen,
  type IPolicy,
  retry,
  TaskCancelledError,
  timeout,
  TimeoutStrategy,
  wrap,
} from 'cockatiel';

export const PETS_GRPC_CLIENT = Symbol('PETS_GRPC_CLIENT');

const RETRYABLE = [GrpcStatus.UNAVAILABLE, GrpcStatus.DEADLINE_EXCEEDED];

// повторяются недоступность и таймаут; NOT_FOUND и FAILED_PRECONDITION – окончательный ответ pets-service
function isRetryable(error: unknown): boolean {
  return error instanceof TaskCancelledError || RETRYABLE.includes((error as { code?: number } | null)?.code ?? -1);
}

/** Политика вызова pets-service (§9): таймаут 2 с на попытку, 2 повтора, circuit breaker после 5 отказов подряд. */
export function createPetCarePolicy(): IPolicy {
  return wrap(
    retry(handleWhen(isRetryable), { maxAttempts: 2, backoff: new ExponentialBackoff({ initialDelay: 200 }) }),
    circuitBreaker(handleWhen(isRetryable), { halfOpenAfter: 10_000, breaker: new ConsecutiveBreaker(5) }),
    timeout(2_000, TimeoutStrategy.Aggressive),
  );
}

/** gRPC-клиент PetCare: повтор идёт с тем же actionId, поэтому эффект не применится дважды. */
@Injectable()
export class PetCareClient implements OnModuleInit {
  private readonly policy: IPolicy = createPetCarePolicy();
  private pets: PetCare;

  constructor(@Inject(PETS_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.pets = this.client.getService<PetCare>(PET_CARE_SERVICE);
  }

  apply(_request: ApplyCareActionRequest): Promise<PetSnapshot> {
    throw new NotImplementedException();
  }
}
