import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';
import { USERS_SWAGGER } from './swagger';

void bootstrapService(AppModule, { swagger: USERS_SWAGGER });
