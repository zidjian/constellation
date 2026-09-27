import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/identity/domain/ports';
import { ENV } from '../src/shared/infrastructure/config/config.module';
import { loadDotEnv, loadEnv } from '../src/shared/infrastructure/config/env';
import type { ApiErrorBody } from '../src/shared/presentation/api-exception.filter';
import { configureApp } from '../src/shared/presentation/configure-app';

type Data<T> = { data: T };

/** Captura el enlace en vez de mandarlo: el e2e no sale a la red. */
class FakeMailer implements Mailer {
  readonly enviados: { to: string; url: string }[] = [];
  sendPasswordReset(to: string, url: string): Promise<void> {
    this.enviados.push({ to, url });
    return Promise.resolve();
  }
}

describe('Cuenta con correo (e2e, Postgres)', () => {
  let app: INestApplication<App>;
  const mailer = new FakeMailer();
  const clave = 'constelacion2026';
  const correo = (n: string) => `test-mail-${n}@example.com`;

  const http = () => request(app.getHttpServer());
  const code = (res: request.Response) => (res.body as ApiErrorBody).error.code;
  const cookieOf = (res: request.Response) =>
    (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) =>
      c.startsWith('cst_session='),
    );
  const tokenDe = (url: string) => new URL(url).searchParams.get('token')!;

  beforeAll(async () => {
    loadDotEnv();
    const env = loadEnv({
      ...process.env,
      JWT_SECRET: 'e2e-'.padEnd(40, 'x'),
      DISCORD_CLIENT_ID: 'e2e',
      DISCORD_CLIENT_SECRET: 'e2e',
      DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
      WEB_ORIGIN: 'http://localhost:3000',
      LLM_PROVIDER: 'rules',
      RESEND_API_KEY: '',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { webOrigin: env.WEB_ORIGIN });
    await app.init();
    await app.get(DataSource).runMigrations();
    await limpiar();
  });

  const limpiar = () =>
    app
      .get(DataSource)
      .query(`DELETE FROM users WHERE email LIKE 'test-mail-%@example.com'`);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('el alta crea la cuenta y deja la sesión abierta', async () => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: correo('alta'), password: clave })
      .expect(201);

    expect(cookieOf(res)).toMatch(/HttpOnly/);
    const { user } = (
      res.body as Data<{
        user: { id: string; email: string; username: string };
      }>
    ).data;
    expect(user.id).toHaveLength(36);
    expect(user.email).toBe(correo('alta'));
    expect(user.username).toBe('test-mail-alta');

    // La cookie sirve de verdad en una ruta protegida.
    const me = await http()
      .get('/v1/me')
      .set('Cookie', cookieOf(res)!)
      .expect(200);
    expect((me.body as Data<{ email: string }>).data.email).toBe(
      correo('alta'),
    );
  });

  it('el correo no distingue mayúsculas y no se repite', async () => {
    await http()
      .post('/v1/auth/register')
      .send({ email: correo('repe'), password: clave })
      .expect(201);
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: correo('repe').toUpperCase(), password: clave })
      .expect(409);
    expect(code(res)).toBe('EMAIL_TAKEN');
  });

  it('rechaza una contraseña floja sin crear la cuenta', async () => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: correo('floja'), password: 'holahola' })
      .expect(400);
    expect(['WEAK_PASSWORD', 'VALIDATION_ERROR']).toContain(code(res));
  });

  it('login: entra con la clave correcta y no con otra', async () => {
    await http()
      .post('/v1/auth/register')
      .send({ email: correo('login'), password: clave })
      .expect(201);

    const ok = await http()
      .post('/v1/auth/login')
      .send({ email: correo('login').toUpperCase(), password: clave })
      .expect(200);
    expect(cookieOf(ok)).toBeDefined();

    const mal = await http()
      .post('/v1/auth/login')
      .send({ email: correo('login'), password: 'otraclave2026' })
      .expect(401);
    expect(code(mal)).toBe('INVALID_CREDENTIALS');
  });

  it('recuperar responde igual exista o no la cuenta', async () => {
    const existe = await http()
      .post('/v1/auth/forgot-password')
      .send({ email: correo('alta') })
      .expect(202);
    const noExiste = await http()
      .post('/v1/auth/forgot-password')
      .send({ email: correo('fantasma') })
      .expect(202);
    expect(existe.body).toEqual(noExiste.body);
  });

  it('el enlace de recuperación cambia la contraseña y solo sirve una vez', async () => {
    const email = correo('reset');
    await http()
      .post('/v1/auth/register')
      .send({ email, password: clave })
      .expect(201);

    mailer.enviados.length = 0;
    await http().post('/v1/auth/forgot-password').send({ email }).expect(202);
    expect(mailer.enviados).toHaveLength(1);
    const token = tokenDe(mailer.enviados[0].url);

    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ token, password: 'nuevaclave2026' })
      .expect(200);
    expect(cookieOf(res)).toBeDefined();

    await http()
      .post('/v1/auth/login')
      .send({ email, password: 'nuevaclave2026' })
      .expect(200);
    await http()
      .post('/v1/auth/login')
      .send({ email, password: clave })
      .expect(401);

    const repetido = await http()
      .post('/v1/auth/reset-password')
      .send({ token, password: 'otraclave2026' })
      .expect(400);
    expect(code(repetido)).toBe('RESET_TOKEN_INVALID');
  });

  it('un token inventado no sirve', async () => {
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ token: 'inventado', password: 'nuevaclave2026' })
      .expect(400);
    expect(code(res)).toBe('RESET_TOKEN_INVALID');
  });
});
