import { resolve } from 'node:path';
import type { Observable } from 'rxjs';

/** gRPC PetCare (libs/contracts/proto/pets.proto): care-service → pets-service. */
export const PET_CARE_PACKAGE = 'pets.v1';
export const PET_CARE_SERVICE = 'PetCare';
export const PETS_GRPC_PORT = 50051;

// proto читается во время работы: в контейнере лежит в /app/libs/contracts/proto, локально – в корне репозитория
export const PETS_PROTO_PATH = resolve(process.cwd(), 'libs/contracts/proto/pets.proto');

// поля snake_case из .proto приходят в camelCase, int32 – числами, пустые поля – значениями по умолчанию
export const PETS_PROTO_LOADER_OPTIONS = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
};

export interface ApplyCareActionRequest {
  actionId: string;
  petId: string;
  ownerId: string;
  type: string;
  hungerDelta: number;
  happinessDelta: number;
  weightDelta: number;
  curesSickness: boolean;
}

export interface GetPetSnapshotRequest {
  petId: string;
  ownerId: string;
}

export interface PetSnapshot {
  petId: string;
  name: string;
  stage: string;
  formCode: string;
  hunger: number;
  happiness: number;
  discipline: number;
  weight: number;
  poopCount: number;
  isSick: boolean;
  isSleeping: boolean;
  careMistakes: number;
  careMistakeMade: boolean;
}

/** Сервис PetCare в том виде, в каком его отдаёт ClientGrpc.getService() и реализует контроллер. */
export interface PetCare {
  applyCareAction(request: ApplyCareActionRequest): Observable<PetSnapshot>;
  getPetSnapshot(request: GetPetSnapshotRequest): Observable<PetSnapshot>;
}
