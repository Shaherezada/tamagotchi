import { INestApplication, Logger, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { BaseEnv } from '../config/base-env';
import { ProblemDetailsFilter } from '../errors/problem-details.filter';
import { createValidationPipe } from '../errors/validation';
import { requestIdMiddleware } from '../request-id/request-id.middleware';
import { setupSwagger, SwaggerOptions } from '../swagger/swagger';

export const API_PREFIX = 'api';

export interface ServiceOptions {
  swagger: SwaggerOptions;
  /** Второй транспорт того же приложения (gRPC у pets-service). */
  microservice?: (app: INestApplication) => MicroserviceOptions;
}

/** HTTP-настройки, одинаковые для сервиса, e2e-тестов и экспорта OpenAPI. */
export function configureHttpApp(app: INestApplication, options: ServiceOptions): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestIdMiddleware);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
  setupSwagger(app, options.swagger);
}

/** Запуск сервиса: окружение проверяется при создании модулей, затем HTTP (и gRPC, если задан). */
export async function bootstrapService(module: Type<unknown>, options: ServiceOptions): Promise<INestApplication> {
  const app = await NestFactory.create(module);
  app.enableShutdownHooks();
  configureHttpApp(app, options);
  if (options.microservice) {
    app.connectMicroservice<MicroserviceOptions>(options.microservice(app));
    await app.startAllMicroservices();
  }
  const env = app.get(BaseEnv);
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('bootstrap').log(
    `${options.swagger.service}: HTTP ${env.PORT}, Swagger /docs/${options.swagger.docsName}`,
  );
  return app;
}
