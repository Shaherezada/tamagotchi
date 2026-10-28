import {
  type ApplyCareActionRequest,
  type GetPetSnapshotRequest,
  PET_CARE_SERVICE,
  type PetCare,
  type PetSnapshot,
} from '@app/contracts';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
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
import { fromEvent, lastValueFrom, Observable, takeUntil } from 'rxjs';

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

  apply(request: ApplyCareActionRequest): Promise<PetSnapshot> {
    return this.call((pets) => pets.applyCareAction(request));
  }

  /** Состояние без изменений: настроение до игры (награда) и проверка владельца в истории ухода. */
  snapshot(request: GetPetSnapshotRequest): Promise<PetSnapshot> {
    return this.call((pets) => pets.getPetSnapshot(request));
  }

  // таймаут политики отменяет попытку через signal – отписка обрывает вызов gRPC
  private call(rpc: (pets: PetCare) => Observable<PetSnapshot>): Promise<PetSnapshot> {
    return this.policy.execute(({ signal }) =>
      lastValueFrom(rpc(this.pets).pipe(takeUntil(fromEvent(signal, 'abort')))),
    );
  }
}

/** Окончательный отказ pets-service: предмет возвращается, действие REJECTED. */
export interface PetCareRejection {
  status: HttpStatus.NOT_FOUND | HttpStatus.CONFLICT;
  /** Код для care_actions.reject_reason, не длиннее 32 символов. */
  reason: string;
  detail: string;
}

const REASON_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/;

/**
 * Ошибка вызова PetCare → отказ (§5: NOT_FOUND – 404, FAILED_PRECONDITION – 409) или null,
 * если pets-service недоступен (таймаут, UNAVAILABLE, разомкнутый breaker и прочее) – тогда 503 и повтор.
 */
export function toPetCareRejection(error: unknown): PetCareRejection | null {
  const { code, details } = (error ?? {}) as { code?: number; details?: string };
  // pets-service может передать в details машинный код причины, например PET_SLEEPING
  const reason = details && REASON_PATTERN.test(details) ? details : undefined;
  if (code === GrpcStatus.NOT_FOUND) {
    return { status: HttpStatus.NOT_FOUND, reason: reason ?? 'PET_NOT_FOUND', detail: 'Питомец не найден' };
  }
  if (code === GrpcStatus.FAILED_PRECONDITION) {
    return {
      status: HttpStatus.CONFLICT,
      reason: reason ?? 'PET_UNAVAILABLE',
      detail: reason ? `Питомец сейчас не может принять уход: ${reason}` : details || 'Питомец спит, ещё яйцо или умер',
    };
  }
  return null;
}
