import { ConfigModule, DatabaseModule, JwtAuthModule, RabbitMqModule } from '@app/common';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { PETS_SCHEMA } from './database';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PetCareGrpcModule } from './pet-care-grpc/pet-care-grpc.module';
import { PetsModule } from './pets/pets.module';
import { PETS_ENV_PREFIX, PetsEnv } from './pets-env';

@Module({
  imports: [
    ConfigModule.forRoot(PetsEnv, PETS_ENV_PREFIX),
    DatabaseModule.forRoot(PETS_SCHEMA),
    ScheduleModule.forRoot(),
    RabbitMqModule.forRoot(),
    JwtAuthModule,
    PetsModule,
    LifecycleModule,
    AdminModule,
    PetCareGrpcModule,
  ],
})
export class AppModule {}
