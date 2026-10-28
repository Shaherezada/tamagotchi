import type { ApplyCareActionRequest, GetPetSnapshotRequest, PetSnapshot } from '@app/contracts';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GameRules } from '../lifecycle/game-rules';

/**
 * Уход по gRPC от care-service. Ошибки – RpcException с кодом gRPC (§5): NOT_FOUND – нет питомца
 * или он чужой, FAILED_PRECONDITION – спит, ещё яйцо или умер.
 */
@Injectable()
export class PetCareService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rules: GameRules,
  ) {}

  /** Питомец, applied_care_actions и хронология – одной транзакцией; повтор actionId вернёт прежний результат. */
  apply(_request: ApplyCareActionRequest): Promise<PetSnapshot> {
    throw new NotImplementedException();
  }

  snapshot(_request: GetPetSnapshotRequest): Promise<PetSnapshot> {
    throw new NotImplementedException();
  }
}
