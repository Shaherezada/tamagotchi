import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import amqp from 'amqplib';
import Redis from 'ioredis';

/**
 * Окружение e2e: .env того же compose, против которого идёт сценарий; переменные процесса важнее.
 * process.loadEnvFile не подходит: Jest даёт тесту свою копию process.env.
 */
const ROOT = resolve(__dirname, '../..');
const ENV_FILE = resolve(ROOT, '.env');
const env: Record<string, string | undefined> = {
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}),
  ...process.env,
};

export const BASE_URL = env.E2E_BASE_URL ?? 'http://localhost:8080';
export const ADMIN_LOGIN = env.ADMIN_LOGIN ?? 'admin';
export const ADMIN_PASSWORD = env.ADMIN_PASSWORD ?? '';
// брокер и Redis – на портах, которые compose открывает наружу
const RABBITMQ_URL =
  env.E2E_RABBITMQ_URL ?? `amqp://${env.RABBITMQ_USER ?? 'guest'}:${env.RABBITMQ_PASSWORD ?? 'guest'}@localhost:5672`;
const REDIS_URL = env.E2E_REDIS_URL ?? 'redis://localhost:6379';
export const EVENTS_EXCHANGE = 'tamagotchi.events';

export interface ApiResponse<T> {
  status: number;
  contentType: string;
  body: T;
}

/** Запрос к API через nginx; тело – JSON или FormData. */
export async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  options: { token?: string; json?: unknown; form?: FormData } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: string | FormData | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }
  const response = await fetch(BASE_URL + path, { method, headers, body });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  return { status: response.status, contentType, body: (text ? JSON.parse(text) : undefined) as T };
}

/** Опрос до выполнения условия: асинхронные шаги ждутся с таймаутом, а не паузой вслепую. */
export async function waitFor<T>(
  description: string,
  probe: () => Promise<T | undefined | null | false>,
  { timeoutMs = 30_000, intervalMs = 500 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Не дождались за ${timeoutMs} мс: ${description}${lastError ? ` (${String(lastError)})` : ''}`);
}

/** Уникальный логин: сценарий проходит повторно на тех же базах. */
export function uniqueLogin(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 32);
}

export function jwtPayload(token: string): { sub: string; jti: string; role: string; exp: number } {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

export function compose(...args: string[]): void {
  execFileSync('docker', ['compose', ...args], { cwd: ROOT, stdio: 'pipe' });
}

export function redis(): Redis {
  return new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
}

/** Временная очередь на exchange событий: что реально ушло в RabbitMQ. */
export async function listenEvents(...routingKeys: string[]) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
  for (const key of routingKeys) {
    await channel.bindQueue(queue, EVENTS_EXCHANGE, key);
  }
  const received: { routingKey: string; body: { eventId: string; type: string; payload: Record<string, unknown> } }[] =
    [];
  await channel.consume(
    queue,
    (message) => {
      if (message) {
        received.push({ routingKey: message.fields.routingKey, body: JSON.parse(message.content.toString()) });
      }
    },
    { noAck: true },
  );
  return {
    received,
    close: async () => {
      await channel.close();
      await connection.close();
    },
  };
}

export interface SseEvent {
  event: string;
  data: unknown;
}

/** Подписка на SSE: события копятся в events, пока не вызван close. */
export async function openSse(path: string, token: string) {
  const controller = new AbortController();
  const response = await fetch(BASE_URL + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  const events: SseEvent[] = [];
  const done = (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const field = (name: string) =>
            block
              .split('\n')
              .filter((line) => line.startsWith(`${name}:`))
              .map((line) => line.slice(name.length + 1).trim())
              .join('\n');
          const data = field('data');
          if (data) events.push({ event: field('event') || 'message', data: JSON.parse(data) });
        }
      }
    } catch {
      // соединение закрыто через abort
    }
  })();
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    events,
    close: async () => {
      controller.abort();
      await done;
    },
  };
}

/** Минимальный PNG 1×1 для загрузки иконки. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
