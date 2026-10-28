import { bootstrapService } from '@app/common';
import { AppModule } from './app.module';
import { NOTIFICATIONS_SWAGGER } from './swagger';

void bootstrapService(AppModule, { swagger: NOTIFICATIONS_SWAGGER });
