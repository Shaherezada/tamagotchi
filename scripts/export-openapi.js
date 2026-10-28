/**
 * Экспорт OpenAPI без PostgreSQL, RabbitMQ и Redis: приложение создаётся в режиме preview
 * (провайдеры не создаются, соединений нет), документ строится так же, как для Swagger UI сервиса.
 *
 *   node scripts/export-openapi.js                  – все сервисы и склейка docs/openapi/tamagotchi.json
 *   node scripts/export-openapi.js users-service    – только docs/openapi/users-service.json
 *   node scripts/export-openapi.js --merge-only     – только склейка из готовых файлов сервисов
 *
 * Перед экспортом сервис нужно собрать: npm run build (или npm run build:users и т. д.).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'openapi');
const SERVICES = ['users-service', 'pets-service', 'care-service', 'notifications-service'];
const GATEWAY_URL = 'http://localhost:8080';

function distPath(service, ...parts) {
  return path.join(ROOT, 'dist', 'apps', service, ...parts);
}

async function exportService(service) {
  const appModulePath = distPath(service, 'apps', service, 'src', 'app.module.js');
  if (!fs.existsSync(appModulePath)) {
    throw new Error(`${service} не собран: нет ${path.relative(ROOT, appModulePath)}. Запустите npm run build`);
  }
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require(appModulePath);
  const swagger = require(distPath(service, 'apps', service, 'src', 'swagger.js'));
  const common = require(distPath(service, 'libs', 'common', 'src', 'index.js'));
  const options = Object.values(swagger).find((value) => value && typeof value === 'object' && value.docsName);

  const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'], abortOnError: false });
  app.setGlobalPrefix(common.API_PREFIX);
  const document = common.buildOpenApiDocument(app, options);
  await app.close();

  const file = path.join(OUT_DIR, `${service}.json`);
  fs.writeFileSync(file, JSON.stringify(document, null, 2) + '\n');
  console.log(`${path.relative(ROOT, file)}: ${Object.keys(document.paths).length} путей`);
  return document;
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectRefs(node, refs = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, refs));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.add(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

/** Склейка: пути всех сервисов, общие схемы один раз, теги по сервисам, сервер – шлюз nginx. */
function merge(documents) {
  const merged = {
    openapi: documents[0].openapi,
    info: {
      title: 'Тамагочи – внешний API',
      description:
        'Серверная часть системы ухода за виртуальными питомцами. Все запросы – через nginx на ' +
        `${GATEWAY_URL}; кроме входа, регистрации и каталога нужен заголовок Authorization: Bearer <JWT>. ` +
        'Ошибки – application/problem+json (RFC 9457).',
      version: documents[0].info.version,
    },
    servers: [{ url: GATEWAY_URL, description: 'API-шлюз nginx' }],
    tags: [],
    paths: {},
    components: { schemas: {}, securitySchemes: {} },
  };
  for (const doc of documents) {
    for (const tag of doc.tags ?? []) {
      if (!merged.tags.some((t) => t.name === tag.name)) merged.tags.push(tag);
    }
    for (const [route, operations] of Object.entries(doc.paths)) {
      const target = (merged.paths[route] ??= {});
      for (const [method, operation] of Object.entries(operations)) {
        if (target[method]) throw new Error(`${method.toUpperCase()} ${route} описан в двух сервисах`);
        target[method] = operation;
      }
    }
    for (const section of ['schemas', 'securitySchemes']) {
      for (const [name, schema] of Object.entries(doc.components?.[section] ?? {})) {
        const existing = merged.components[section][name];
        if (existing && !same(existing, schema)) {
          throw new Error(`components.${section}.${name} различается в сервисах – переименуйте одну из схем`);
        }
        merged.components[section][name] = schema;
      }
    }
  }
  for (const ref of collectRefs(merged)) {
    const name = ref.replace('#/components/schemas/', '');
    if (!merged.components.schemas[name]) throw new Error(`Нет схемы для ссылки ${ref}`);
  }
  return merged;
}

async function main() {
  const args = process.argv.slice(2);
  const mergeOnly = args.includes('--merge-only');
  const selected = args.filter((a) => !a.startsWith('--'));
  for (const service of selected) {
    if (!SERVICES.includes(service)) throw new Error(`Неизвестный сервис ${service}; есть: ${SERVICES.join(', ')}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!mergeOnly) {
    for (const service of selected.length ? selected : SERVICES) {
      await exportService(service);
    }
  }
  if (mergeOnly || selected.length === 0) {
    const documents = SERVICES.map((service) => {
      const file = path.join(OUT_DIR, `${service}.json`);
      if (!fs.existsSync(file)) throw new Error(`Нет ${path.relative(ROOT, file)}: сначала экспортируйте сервис`);
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    });
    const merged = merge(documents);
    const file = path.join(OUT_DIR, 'tamagotchi.json');
    fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
    console.log(`${path.relative(ROOT, file)}: ${Object.keys(merged.paths).length} путей`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
