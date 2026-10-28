import { PET_CARE_PACKAGE, PETS_PROTO_LOADER_OPTIONS, PETS_PROTO_PATH } from '@app/contracts';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareEnv } from '../care-env';
import { InventoryModule } from '../inventory/inventory.module';
import { ItemsModule } from '../items/items.module';
import { WalletModule } from '../wallet/wallet.module';
import { CareAction } from './care-action.entity';
import { CareActionRetrier } from './care-action.retrier';
import { CareActionsController } from './care-actions.controller';
import { CareActionsService } from './care-actions.service';
import { PETS_GRPC_CLIENT, PetCareClient } from './pet-care.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([CareAction]),
    ItemsModule,
    InventoryModule,
    WalletModule,
    ClientsModule.registerAsync([
      {
        name: PETS_GRPC_CLIENT,
        inject: [CareEnv],
        useFactory: (env: CareEnv) => ({
          transport: Transport.GRPC,
          options: {
            package: PET_CARE_PACKAGE,
            protoPath: PETS_PROTO_PATH,
            url: env.PETS_GRPC_URL,
            loader: PETS_PROTO_LOADER_OPTIONS,
          },
        }),
      },
    ]),
  ],
  controllers: [CareActionsController],
  providers: [CareActionsService, CareActionRetrier, PetCareClient],
})
export class CareActionsModule {}
