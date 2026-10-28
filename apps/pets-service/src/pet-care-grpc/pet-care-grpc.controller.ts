import {
  type ApplyCareActionRequest,
  type GetPetSnapshotRequest,
  PET_CARE_SERVICE,
  type PetCare,
  type PetSnapshot,
} from '@app/contracts';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import { PetCareService } from './pet-care.service';

/** gRPC-сервер PetCare (pets.proto) на порту GRPC_PORT. */
@Controller()
export class PetCareGrpcController implements PetCare {
  constructor(private readonly care: PetCareService) {}

  @GrpcMethod(PET_CARE_SERVICE, 'ApplyCareAction')
  applyCareAction(request: ApplyCareActionRequest): Observable<PetSnapshot> {
    return from(this.care.apply(request));
  }

  @GrpcMethod(PET_CARE_SERVICE, 'GetPetSnapshot')
  getPetSnapshot(request: GetPetSnapshotRequest): Observable<PetSnapshot> {
    return from(this.care.snapshot(request));
  }
}
