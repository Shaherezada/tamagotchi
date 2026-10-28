import { Body, Controller, Get, INestApplication, NotFoundException, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import request from 'supertest';
import { requestIdMiddleware } from '../request-id/request-id.middleware';
import { ProblemDetailsFilter } from './problem-details.filter';
import { ProblemException } from './problem.exception';
import { createValidationPipe } from './validation';

class ItemDto {
  @IsString()
  code: string;
}

class OrderDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @ValidateNested()
  @Type(() => ItemDto)
  item: ItemDto;
}

@Controller('test')
class TestController {
  @Get('problem')
  problem(): never {
    throw ProblemException.conflict('insufficient-funds', 'Недостаточно монет', 'Покупка стоит 30 монет, на счету 12');
  }

  @Get('crash')
  crash(): never {
    throw new Error('connection to db failed: password=secret');
  }

  @Get('http')
  http(): never {
    throw new NotFoundException('Pet 42 not found in table pets');
  }

  @Post('order')
  order(@Body() dto: OrderDto): OrderDto {
    return dto;
  }
}

describe('ProblemDetailsFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [TestController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(requestIdMiddleware);
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(() => app.close());

  it('отдаёт ProblemException как problem+json с instance и requestId', async () => {
    const res = await request(app.getHttpServer()).get('/test/problem?x=1').set('X-Request-Id', 'req-1');

    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.headers['x-request-id']).toBe('req-1');
    expect(res.body).toEqual({
      type: 'https://tamagotchi.local/problems/insufficient-funds',
      title: 'Недостаточно монет',
      status: 409,
      detail: 'Покупка стоит 30 монет, на счету 12',
      instance: '/test/problem',
      requestId: 'req-1',
    });
  });

  it('у ошибки валидации перечисляет поля в errors[], включая вложенные и лишние', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/order')
      .send({ quantity: 0, item: { code: 5 }, extra: true });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body.type).toBe('https://tamagotchi.local/problems/validation-error');
    expect(res.body.title).toBe('Ошибка валидации');
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['quantity', 'item.code', 'extra']));
  });

  it('неожиданную ошибку отдаёт как 500 без текста исключения и stack trace', async () => {
    const res = await request(app.getHttpServer()).get('/test/crash');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      type: 'https://tamagotchi.local/problems/internal',
      title: 'Внутренняя ошибка сервера',
      status: 500,
      instance: '/test/crash',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('стандартное исключение Nest получает заголовок по коду, а не свой текст', async () => {
    const res = await request(app.getHttpServer()).get('/test/http');

    expect(res.status).toBe(404);
    expect(res.body.title).toBe('Не найдено');
    expect(JSON.stringify(res.body)).not.toContain('table pets');
  });

  it('неизвестный маршрут – тоже problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/nowhere');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body.instance).toBe('/nowhere');
  });
});
