import {
  Body,
  Controller,
  Get,
  INestApplication,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DomainError } from '../src/shared/domain/domain-error';
import type { ApiErrorBody } from '../src/shared/presentation/api-exception.filter';
import { configureApp } from '../src/shared/presentation/configure-app';

class EchoDto {
  @IsString()
  @MinLength(3)
  name!: string;
}

@Controller('probe')
class ProbeController {
  @Get('ok')
  ok() {
    return { hello: 'world' };
  }

  @Get('domain')
  domain() {
    throw new DomainError('PATH_NOT_FOUND', 'La ruta no existe', 'not_found');
  }

  @Get('http')
  http() {
    throw new NotFoundException();
  }

  @Get('boom')
  boom() {
    throw new Error('detalle interno secreto');
  }

  @Post('echo')
  echo(@Body() dto: EchoDto) {
    return dto;
  }
}

const errorOf = (res: request.Response) => (res.body as ApiErrorBody).error;

describe('Formato único de API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { webOrigin: 'http://localhost:3000' });
    await app.init();
  });

  afterAll(() => app.close());

  it('envuelve el éxito en { data }', () =>
    request(app.getHttpServer())
      .get('/v1/probe/ok')
      .expect(200)
      .expect({ data: { hello: 'world' } }));

  it('mapea DomainError a su HTTP y código estable', () =>
    request(app.getHttpServer())
      .get('/v1/probe/domain')
      .expect(404)
      .expect({
        error: { code: 'PATH_NOT_FOUND', message: 'La ruta no existe' },
      }));

  it('mapea HttpException de Nest a un código por status', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/probe/http')
      .expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });

  it('responde NOT_FOUND para rutas inexistentes', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/no-existe')
      .expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });

  it('no filtra detalles de errores no controlados', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/probe/boom')
      .expect(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    });
  });

  it('valida el body y rechaza campos no declarados', async () => {
    const short = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .send({ name: 'ab' })
      .expect(400);
    expect(errorOf(short).code).toBe('VALIDATION_ERROR');

    const extra = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .send({ name: 'abc', admin: true })
      .expect(400);
    expect(errorOf(extra).message).toMatch(/admin/);
  });

  it('permite CORS con credenciales solo para WEB_ORIGIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/probe/ok')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
