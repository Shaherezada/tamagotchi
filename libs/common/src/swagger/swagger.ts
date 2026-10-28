import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { FieldError, ProblemDetails } from '../errors/problem-details';

export const BEARER_AUTH = 'bearer';

export interface SwaggerOptions {
  /** Имя сервиса – тег всех его методов, например users-service. */
  service: string;
  /** Короткое имя в адресе Swagger UI: /docs/<docsName>. */
  docsName: string;
  title: string;
  description: string;
}

export function docsPath(options: SwaggerOptions): string {
  return `docs/${options.docsName}`;
}

export function buildOpenApiDocument(app: INestApplication, options: SwaggerOptions): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion('0.1.0')
    .addTag(options.service, options.description)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER_AUTH)
    .build();
  return SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetails, FieldError],
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

/** Swagger UI сервиса на /docs/<docsName>, JSON – на /docs/<docsName>-json; nginx проксирует их без изменений. */
export function setupSwagger(app: INestApplication, options: SwaggerOptions): void {
  const document = buildOpenApiDocument(app, options);
  SwaggerModule.setup(docsPath(options), app, document, {
    customSiteTitle: options.title,
    swaggerOptions: { persistAuthorization: true },
  });
}
