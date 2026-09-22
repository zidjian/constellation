import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DISCORD_OAUTH, type DiscordOAuth } from '../src/identity/domain/ports';
import type { DiscordProfile } from '../src/identity/domain/user';
import { ENV } from '../src/shared/infrastructure/config/config.module';
import {
  loadDotEnv,
  loadEnv,
  type Env,
} from '../src/shared/infrastructure/config/env';
import type { ApiErrorBody } from '../src/shared/presentation/api-exception.filter';
import { configureApp } from '../src/shared/presentation/configure-app';

// Flujo de identidad contra Postgres real; Discord se sustituye por un doble.
class FakeDiscord implements DiscordOAuth {
  profile: DiscordProfile = {
    discordId: 'test-1001',
    username: 'ada',
    avatarUrl: null,
  };
  fail = false;
  authorizeUrl(state: string) {
    return `https://discord.com/oauth2/authorize?state=${state}`;
  }
  fetchProfile(): Promise<DiscordProfile> {
    return this.fail
      ? Promise.reject(new Error('discord caído'))
      : Promise.resolve(this.profile);
  }
}

const cookiesOf = (res: request.Response): string[] => {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
};
const cookie = (res: request.Response, name: string) =>
  cookiesOf(res).find((c) => c.startsWith(`${name}=`));
const valueOf = (setCookie: string | undefined) =>
  setCookie?.split(';')[0].split('=')[1];

async function buildApp(env: Env, discord: FakeDiscord) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DISCORD_OAUTH)
    .useValue(discord)
    .overrideProvider(ENV)
    .useValue(env)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  configureApp(app, { webOrigin: env.WEB_ORIGIN });
  await app.init();
  return app;
}

describe('Identidad (e2e, Postgres)', () => {
  let app: INestApplication<App>;
  let env: Env;
  const discord = new FakeDiscord();

  // Login completo: /auth/discord (state en cookie) → callback con ese state.
  async function login(): Promise<string> {
    const start = await request(app.getHttpServer())
      .get('/v1/auth/discord')
      .expect(302);
    const stateCookie = cookie(start, 'cst_oauth_state')!;
    const state = new URL(start.headers.location).searchParams.get('state');
    const cb = await request(app.getHttpServer())
      .get(`/v1/auth/discord/callback?code=abc&state=${state}`)
      .set('Cookie', stateCookie.split(';')[0])
      .expect(302);
    expect(cb.headers.location).toBe(`${env.WEB_ORIGIN}/paths`);
    return cookie(cb, 'cst_session')!;
  }

  beforeAll(async () => {
    loadDotEnv();
    env = loadEnv({
      ...process.env,
      JWT_SECRET: 'e2e-'.padEnd(40, 'x'),
      DISCORD_CLIENT_ID: 'e2e',
      DISCORD_CLIENT_SECRET: 'e2e',
      DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
    });
    app = await buildApp(env, discord);
    await app.get(DataSource).runMigrations();
  });

  afterAll(async () => {
    await app
      .get(DataSource)
      .query(`DELETE FROM users WHERE discord_id LIKE 'test-%'`);
    await app.close();
  });

  it('sin sesión: /me y el catálogo responden 401 UNAUTHENTICATED; health es público', async () => {
    for (const path of ['/v1/me', '/v1/catalog/courses']) {
      const res = await request(app.getHttpServer()).get(path).expect(401);
      expect((res.body as ApiErrorBody).error.code).toBe('UNAUTHENTICATED');
    }
    await request(app.getHttpServer()).get('/v1/health').expect(200);
  });

  it('inicia OAuth con un state aleatorio guardado en cookie httpOnly', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/auth/discord')
      .expect(302);
    const state = new URL(res.headers.location).searchParams.get('state');
    const stateCookie = cookie(res, 'cst_oauth_state');
    expect(state).toHaveLength(32);
    expect(valueOf(stateCookie)).toBe(state);
    expect(stateCookie).toMatch(/HttpOnly/);
    expect(stateCookie).toMatch(/Path=\/v1\/auth\/discord/);
  });

  it.each([
    ['state distinto', 'otro', true],
    ['sin cookie de state', undefined, false],
  ])(
    'rechaza el callback con %s (anti-CSRF)',
    async (_, forcedState, withCookie) => {
      const start = await request(app.getHttpServer()).get('/v1/auth/discord');
      const realState = new URL(start.headers.location).searchParams.get(
        'state',
      );
      const req = request(app.getHttpServer()).get(
        `/v1/auth/discord/callback?code=abc&state=${forcedState ?? realState}`,
      );
      if (withCookie)
        req.set('Cookie', cookie(start, 'cst_oauth_state')!.split(';')[0]);
      const res = await req.expect(302);
      expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/?error=auth`);
      expect(cookie(res, 'cst_session')).toBeUndefined();
    },
  );

  it('si Discord falla, vuelve a la web con error=auth sin sesión', async () => {
    discord.fail = true;
    const start = await request(app.getHttpServer()).get('/v1/auth/discord');
    const state = new URL(start.headers.location).searchParams.get('state');
    const res = await request(app.getHttpServer())
      .get(`/v1/auth/discord/callback?code=abc&state=${state}`)
      .set('Cookie', cookie(start, 'cst_oauth_state')!.split(';')[0])
      .expect(302);
    discord.fail = false;
    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/?error=auth`);
    expect(cookie(res, 'cst_session')).toBeUndefined();
  });

  it('login completo: cookie de sesión segura y /me sin tokens', async () => {
    const session = await login();
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    expect(session).not.toMatch(/Domain=/); // local: host-only

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Cookie', session.split(';')[0])
      .expect(200);
    const data = (me.body as { data: Record<string, unknown> }).data;
    expect(Object.keys(data).sort()).toEqual([
      'avatarUrl',
      'discordId',
      'id',
      'username',
    ]);
    expect(data).toMatchObject({
      discordId: 'test-1001',
      username: 'ada',
      avatarUrl: null,
    });

    await request(app.getHttpServer())
      .get('/v1/catalog/courses')
      .set('Cookie', session.split(';')[0])
      .expect(200);
  });

  it('un segundo login con el mismo discordId reutiliza el usuario y actualiza el perfil', async () => {
    const first = await login();
    discord.profile = {
      discordId: 'test-1001',
      username: 'ada-lovelace',
      avatarUrl: 'https://a/b.png',
    };
    const second = await login();
    const idOf = async (c: string) =>
      (
        (
          await request(app.getHttpServer())
            .get('/v1/me')
            .set('Cookie', c.split(';')[0])
        ).body as { data: { id: string; username: string } }
      ).data;
    const [a, b] = [await idOf(first), await idOf(second)];
    expect(a.id).toBe(b.id);
    expect(b.username).toBe('ada-lovelace');
  });

  it('rechaza un JWT firmado con otro secreto', async () => {
    const forged = await new JwtService({
      secret: 'otro-secreto'.padEnd(40, 'y'),
    }).signAsync({
      sub: '00000000-0000-0000-0000-000000000000',
    });
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Cookie', `cst_session=${forged}`)
      .expect(401);
  });

  it('logout borra la cookie de sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .expect(200);
    const cleared = cookie(res, 'cst_session');
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('en producción la cookie lleva Domain compartido y Secure', async () => {
    const prod = await buildApp(
      {
        ...env,
        NODE_ENV: 'production',
        COOKIE_DOMAIN: '.constellation.waldirmaidana.com',
      },
      discord,
    );
    const start = await request(prod.getHttpServer()).get('/v1/auth/discord');
    const state = new URL(start.headers.location).searchParams.get('state');
    const cb = await request(prod.getHttpServer())
      .get(`/v1/auth/discord/callback?code=abc&state=${state}`)
      .set('Cookie', cookie(start, 'cst_oauth_state')!.split(';')[0]);
    const session = cookie(cb, 'cst_session');
    expect(session).toMatch(/Domain=\.constellation\.waldirmaidana\.com/);
    expect(session).toMatch(/Secure/);
    // El state no necesita el dominio compartido.
    expect(cookie(start, 'cst_oauth_state')).not.toMatch(/Domain=/);
    await prod.close();
  });
});
