import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { CHALLENGES } from '../src/assessment/domain/challenge-bank';
import { parseCatalogFile } from '../src/catalog/infrastructure/seed/catalog-file.schema';
import { seedCatalog } from '../src/catalog/infrastructure/seed/catalog-seeder';
import type { Question } from '../src/assessment/domain/questions';
import {
  SESSION_TOKENS,
  type SessionTokens,
} from '../src/identity/domain/ports';
import { ENV } from '../src/shared/infrastructure/config/config.module';
import { loadDotEnv, loadEnv } from '../src/shared/infrastructure/config/env';
import type { ApiErrorBody } from '../src/shared/presentation/api-exception.filter';
import { configureApp } from '../src/shared/presentation/configure-app';

type Data<T> = { data: T };
type StartResult = {
  session: { id: string; answeredCount: number; canComplete: boolean };
  question: Question;
};
type AnswerResult = {
  session: { answeredCount: number; canComplete: boolean };
  result: { correct: boolean } | null;
  next: Question | null;
};

describe('Entrevista (e2e, Postgres)', () => {
  let app: INestApplication<App>;
  let alice: string;
  let bob: string;

  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (url: string) => http().get(url).set('Cookie', cookie),
    post: (url: string, body?: object) =>
      http().post(url).set('Cookie', cookie).send(body),
  });
  const code = (res: request.Response) => (res.body as ApiErrorBody).error.code;

  const answerFor = (q: Question): Record<string, unknown> => {
    switch (q.type) {
      case 'text':
        return { text: 'Quiero ser backend con Node, Docker y PostgreSQL' };
      case 'single':
        return { optionId: q.key === 'area' ? 'backend' : 'node' };
      case 'scale':
        return { levels: Object.fromEntries(q.items.map((i) => [i.skill, 1])) };
      case 'challenge':
        return {
          optionId: CHALLENGES.find((c) => `ch:${c.id}` === q.key)!
            .correctOptionId,
        };
    }
  };

  async function answerN(cookie: string, start: StartResult, n: number) {
    let q: Question | null = start.question;
    let last: AnswerResult | null = null;
    for (let i = 0; i < n && q; i++) {
      const res: request.Response = await as(cookie)
        .post(`/v1/assessments/${start.session.id}/answers`, {
          questionKey: q.key,
          answer: answerFor(q),
        })
        .expect(200);
      last = (res.body as Data<AnswerResult>).data;
      q = last.next;
    }
    return last!;
  }

  beforeAll(async () => {
    loadDotEnv();
    const env = loadEnv({
      ...process.env,
      JWT_SECRET: 'e2e-'.padEnd(40, 'x'),
      DISCORD_CLIENT_ID: 'e2e',
      DISCORD_CLIENT_SECRET: 'e2e',
      DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { webOrigin: env.WEB_ORIGIN });
    await app.init();
    const db = app.get(DataSource);
    await db.runMigrations();
    // La entrevista se deriva del catálogo: en una BD limpia (CI) hay que sembrarlo antes.
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

    const tokens = app.get<SessionTokens>(SESSION_TOKENS);
    const user = async (discordId: string) => {
      const [{ id }] = await db.query<{ id: string }[]>(
        `INSERT INTO users (discord_id, username) VALUES ($1, $1)
         ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username RETURNING id`,
        [discordId],
      );
      await db.query(`DELETE FROM assessment_sessions WHERE user_id = $1`, [
        id,
      ]);
      return `cst_session=${await tokens.issue(id)}`;
    };
    alice = await user('test-assess-alice');
    bob = await user('test-assess-bob');
  });

  afterAll(async () => {
    await app
      .get(DataSource)
      .query(`DELETE FROM users WHERE discord_id LIKE 'test-assess-%'`);
    await app.close();
  });

  it('exige sesión', async () => {
    await http().post('/v1/assessments').expect(401);
  });

  it('flujo completo: iniciar → responder → completar produce un SkillProfile', async () => {
    const start = (await as(alice).post('/v1/assessments').expect(201))
      .body as Data<StartResult>;
    expect(start.data.question.key).toBe('goal');

    const last = await answerN(alice, start.data, 10);
    expect(last.session.canComplete).toBe(true);

    const done = await as(alice)
      .post(`/v1/assessments/${start.data.session.id}/complete`)
      .expect(200);
    const { profile, session } = (
      done.body as Data<{
        profile: { targetSkills: string[]; levels: Record<string, number> };
        session: { status: string };
      }>
    ).data;
    expect(session.status).toBe('completed');
    expect(profile.targetSkills).toEqual(['nestjs', 'nodejs', 'docker', 'sql']);
    expect(profile.levels.javascript).toBeGreaterThanOrEqual(1);

    const [row] = await app
      .get(DataSource)
      .query<{ interpreted_by: string }[]>(
        `SELECT interpreted_by FROM skill_profiles WHERE session_id = $1`,
        [start.data.session.id],
      );
    expect(row.interpreted_by).toBe('rules');

    // Criterio de aceptación 3: una evaluación completada es inmutable.
    const again = await as(alice)
      .post(`/v1/assessments/${start.data.session.id}/answers`, {
        questionKey: 'goal',
        answer: { text: 'otra' },
      })
      .expect(409);
    expect(code(again)).toBe('ASSESSMENT_ALREADY_COMPLETED');
    expect(
      code(
        await as(alice)
          .post(`/v1/assessments/${start.data.session.id}/complete`)
          .expect(409),
      ),
    ).toBe('ASSESSMENT_ALREADY_COMPLETED');
  });

  it('informa si acertó un reto', async () => {
    const start = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    const last = await answerN(alice, start, 5);
    expect(last.result).toEqual({ correct: true });
  });

  it('no deja completar antes de 5 respuestas', async () => {
    const start = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    await answerN(alice, start, 2);
    expect(
      code(
        await as(alice)
          .post(`/v1/assessments/${start.session.id}/complete`)
          .expect(400),
      ),
    ).toBe('ASSESSMENT_TOO_SHORT');
  });

  it('valida la pregunta esperada y la forma de la respuesta', async () => {
    const start = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    const url = `/v1/assessments/${start.session.id}/answers`;
    expect(
      code(
        await as(alice)
          .post(url, { questionKey: 'area', answer: { optionId: 'backend' } })
          .expect(409),
      ),
    ).toBe('ASSESSMENT_UNEXPECTED_QUESTION');
    expect(
      code(
        await as(alice)
          .post(url, { questionKey: 'goal', answer: { text: 'no' } })
          .expect(400),
      ),
    ).toBe('ASSESSMENT_INVALID_ANSWER');
    expect(
      code(await as(alice).post(url, { questionKey: 'goal' }).expect(400)),
    ).toBe('VALIDATION_ERROR');
  });

  it('una nueva entrevista abandona la anterior; /current la retoma', async () => {
    const first = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    await answerN(alice, first, 1);
    const current = (
      (await as(alice).get('/v1/assessments/current').expect(200))
        .body as Data<StartResult>
    ).data;
    expect(current.session.id).toBe(first.session.id);
    expect(current.question.key).toBe('area');

    const second = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    expect(second.session.id).not.toBe(first.session.id);
    const old = await as(alice)
      .post(`/v1/assessments/${first.session.id}/answers`, {
        questionKey: 'area',
        answer: { optionId: 'backend' },
      })
      .expect(409);
    expect(code(old)).toBe('ASSESSMENT_ABANDONED');
  });

  it('ownership: la entrevista de otro usuario responde 404', async () => {
    const mine = (
      (await as(alice).post('/v1/assessments').expect(201))
        .body as Data<StartResult>
    ).data;
    const res = await as(bob)
      .post(`/v1/assessments/${mine.session.id}/answers`, {
        questionKey: 'goal',
        answer: { text: 'hola hola' },
      })
      .expect(404);
    expect(code(res)).toBe('ASSESSMENT_NOT_FOUND');
    await as(bob)
      .post(`/v1/assessments/${mine.session.id}/complete`)
      .expect(404);
    expect(
      (
        (await as(bob).get('/v1/assessments/current').expect(200))
          .body as Data<unknown>
      ).data,
    ).toBeNull();
  });

  it('un id que no es UUID es un error de validación', async () => {
    expect(
      code(
        await as(alice).post('/v1/assessments/no-es-uuid/complete').expect(400),
      ),
    ).toBe('VALIDATION_ERROR');
  });
});
