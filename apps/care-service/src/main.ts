import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';
import { CARE_SWAGGER } from './swagger';

void bootstrapService(AppModule, { swagger: CARE_SWAGGER });
