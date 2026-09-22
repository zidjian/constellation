import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CHALLENGES } from '../src/assessment/domain/challenge-bank';
import type { Question } from '../src/assessment/domain/questions';
import { parseCatalogFile } from '../src/catalog/infrastructure/seed/catalog-file.schema';
import { seedCatalog } from '../src/catalog/infrastructure/seed/catalog-seeder';
import {
  SESSION_TOKENS,
  type SessionTokens,
} from '../src/identity/domain/ports';
import { ENV } from '../src/shared/infrastructure/config/config.module';
import { loadDotEnv, loadEnv } from '../src/shared/infrastructure/config/env';
import { configureApp } from '../src/shared/presentation/configure-app';

// Criterio 6: con LLM_PROVIDER=claude y la API de Anthropic inaccesible (clave inválida, llamada real),
// la entrevista y la generación funcionan igual, por reglas.
type Data<T> = { data: T };

describe('Fallback de IA a reglas (e2e, Postgres + red real)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let cookie: string;

  beforeAll(async () => {
    loadDotEnv();
    const env = loadEnv({
      ...process.env,
      JWT_SECRET: 'e2e-'.padEnd(40, 'x'),
      DISCORD_CLIENT_ID: 'e2e',
      DISCORD_CLIENT_SECRET: 'e2e',
      DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
      PATH_STREAM_DELAY_MS: '0',
      LLM_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'sk-ant-invalida-para-e2e',
      LLM_TIMEOUT_MS: '4000',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { webOrigin: env.WEB_ORIGIN });
    await app.listen(0, '127.0.0.1');
    db = app.get(DataSource);
    await db.runMigrations();
    await seedCatalog(
      db,
      parseCatalogFile(
        JSON.parse(
          readFileSync(
            join(__dirname, '../src/catalog/infrastructure/seed/catalog.json'),
            'utf8',
          ),
        ),
      ),
    );
    const [{ id }] = await db.query<{ id: string }[]>(
      `INSERT INTO users (discord_id, username) VALUES ('test-llm-fallback', 'x')
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username RETURNING id`,
    );
    await db.query(`DELETE FROM assessment_sessions WHERE user_id = $1`, [id]);
    cookie = `cst_session=${await app.get<SessionTokens>(SESSION_TOKENS).issue(id)}`;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE discord_id = 'test-llm-fallback'`);
    await app.close();
  });

  it('entrevista y ruta completas con interpreted_by y generated_by = rules', async () => {
    const http = () => request(app.getHttpServer());
    const start = (
      (await http().post('/v1/assessments').set('Cookie', cookie).expect(201))
        .body as Data<{
        session: { id: string };
        question: Question;
      }>
    ).data;
    let q: Question | null = start.question;
    while (q) {
      const answer =
        q.type === 'text'
          ? { text: 'Quiero ser backend con NestJS, Docker y PostgreSQL' }
          : q.type === 'scale'
            ? { levels: Object.fromEntries(q.items.map((i) => [i.skill, 1])) }
            : q.type === 'challenge'
              ? {
                  optionId: CHALLENGES.find((c) => `ch:${c.id}` === q!.key)!
                    .correctOptionId,
                }
              : { optionId: q.key === 'area' ? 'backend' : 'node' };
      const res: request.Response = await http()
        .post(`/v1/assessments/${start.session.id}/answers`)
        .set('Cookie', cookie)
        .send({ questionKey: q.key, answer })
        .expect(200);
      q = (res.body as Data<{ next: Question | null }>).data.next;
    }
    const done = await http()
      .post(`/v1/assessments/${start.session.id}/complete`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      (done.body as Data<{ profile: { targetSkills: string[] } }>).data.profile
        .targetSkills[0],
    ).toBe('nestjs');
    const [profileRow] = await db.query<{ interpreted_by: string }[]>(
      `SELECT interpreted_by FROM skill_profiles WHERE session_id = $1`,
      [start.session.id],
    );
    expect(profileRow.interpreted_by).toBe('rules');

    const port = (
      (app.getHttpServer() as unknown as Server).address() as AddressInfo
    ).port;
    const res = await fetch(`http://127.0.0.1:${port}/v1/paths/generate`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: start.session.id, name: 'Sin IA' }),
    });
    const body = await res.text();
    expect(body).toContain('event: done');
    const pathId = /"pathId":"([^"]+)"/.exec(body)![1];
    const [pathRow] = await db.query<{ generated_by: string }[]>(
      `SELECT generated_by FROM learning_paths WHERE id = $1`,
      [pathId],
    );
    expect(pathRow.generated_by).toBe('rules');
  }, 30000);
});
