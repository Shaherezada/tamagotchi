import { bootstrapService } from '@app/common';
import { PET_CARE_PACKAGE, PETS_PROTO_LOADER_OPTIONS, PETS_PROTO_PATH } from '@app/contracts';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { PetsEnv } from './pets-env';
import { PETS_SWAGGER } from './swagger';

void bootstrapService(AppModule, {
  swagger: PETS_SWAGGER,
  microservice: (app) => ({
    transport: Transport.GRPC,
    options: {
      package: PET_CARE_PACKAGE,
      protoPath: PETS_PROTO_PATH,
      url: `0.0.0.0:${app.get(PetsEnv).GRPC_PORT}`,
      loader: PETS_PROTO_LOADER_OPTIONS,
    },
  }),
});
