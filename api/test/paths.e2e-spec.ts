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
import type { SkillProfile } from '../src/assessment/domain/skill-profile';
import type { Catalog } from '../src/catalog/domain/catalog';
import { parseCatalogFile } from '../src/catalog/infrastructure/seed/catalog-file.schema';
import { seedCatalog } from '../src/catalog/infrastructure/seed/catalog-seeder';
import {
  SESSION_TOKENS,
  type SessionTokens,
} from '../src/identity/domain/ports';
import { ENV } from '../src/shared/infrastructure/config/config.module';
import {
  loadDotEnv,
  loadEnv,
  type Env,
} from '../src/shared/infrastructure/config/env';
import type { ApiErrorBody } from '../src/shared/presentation/api-exception.filter';
import { configureApp } from '../src/shared/presentation/configure-app';

type StepData = { course: { slug: string } };
type SseEvent = { event: string; data: unknown; at: number };
type Data<T> = { data: T };
type PathDetail = {
  id: string;
  name: string;
  status: string;
  progress: { completed: number; total: number };
  steps: {
    id: string;
    position: number;
    rationale: string;
    completedAt: string | null;
    course: { slug: string };
  }[];
  edges: { from: string; to: string }[];
};

const catalog = parseCatalogFile(
  JSON.parse(
    readFileSync(
      join(__dirname, '../src/catalog/infrastructure/seed/catalog.json'),
      'utf8',
    ),
  ),
) as Catalog;

async function buildApp(env: Env) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(env)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  configureApp(app, { webOrigin: env.WEB_ORIGIN });
  await app.listen(0, '127.0.0.1');
  return app;
}

/** Lee el SSE incrementalmente, anotando cuándo llega cada evento. */
async function readStream(
  url: string,
  cookie: string,
  body: object,
  opts: { abortAfter?: (e: SseEvent) => boolean } = {},
): Promise<{ status: number; events: SseEvent[]; json?: ApiErrorBody }> {
  const ac = new AbortController();
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ac.signal,
  });
  if (!res.headers.get('content-type')?.startsWith('text/event-stream')) {
    return {
      status: res.status,
      events: [],
      json: (await res.json()) as ApiErrorBody,
    };
  }
  const events: SseEvent[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let i: number;
      while ((i = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const event = /^event: (.*)$/m.exec(raw)![1];
        const data = JSON.parse(/^data: (.*)$/m.exec(raw)![1]) as unknown;
        const e = { event, data, at: Date.now() - t0 };
        events.push(e);
        if (opts.abortAfter?.(e)) {
          ac.abort();
          return { status: res.status, events };
        }
      }
    }
  } catch (err) {
    if (!ac.signal.aborted) throw err;
  }
  return { status: res.status, events };
}

describe('Rutas de aprendizaje (e2e, Postgres)', () => {
  let app: INestApplication<App>;
  let env: Env;
  let base: string;
  let db: DataSource;
  let alice: { id: string; cookie: string };
  let bob: { id: string; cookie: string };

  const http = () => request(app.getHttpServer());
  const code = (res: request.Response) => (res.body as ApiErrorBody).error.code;

  async function user(discordId: string) {
    const [{ id }] = await db.query<{ id: string }[]>(
      `INSERT INTO users (discord_id, username) VALUES ($1, $1)
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username RETURNING id`,
      [discordId],
    );
    await db.query(`DELETE FROM learning_paths WHERE user_id = $1`, [id]);
    await db.query(`DELETE FROM assessment_sessions WHERE user_id = $1`, [id]);
    return {
      id,
      cookie: `cst_session=${await app.get<SessionTokens>(SESSION_TOKENS).issue(id)}`,
    };
  }

  /** Entrevista completada con un perfil dado (directo en BD: el flujo de preguntas tiene su propio e2e). */
  async function completedAssessment(
    userId: string,
    profile: SkillProfile,
    status = 'completed',
  ) {
    const [{ id }] = await db.query<{ id: string }[]>(
      `INSERT INTO assessment_sessions (id, user_id, status, goal_text, completed_at)
       VALUES (gen_random_uuid(), $1, $2::varchar, $3, CASE WHEN $2::varchar = 'completed' THEN now() END) RETURNING id`,
      [userId, status, profile.goal ?? ''],
    );
    if (status === 'completed') {
      await db.query(
        `INSERT INTO skill_profiles (session_id, levels, target_skills, interpreted_by) VALUES ($1, $2, $3, 'rules')`,
        [id, JSON.stringify(profile.levels), profile.targetSkills],
      );
    }
    return id;
  }

  const backend: SkillProfile = {
    levels: { javascript: 3 },
    targetSkills: ['nestjs', 'docker'],
    goal: 'Backend con Nest',
  };
  const generate = (
    who: { cookie: string },
    body: object,
    opts?: Parameters<typeof readStream>[3],
  ) => readStream(`${base}/v1/paths/generate`, who.cookie, body, opts);

  beforeAll(async () => {
    loadDotEnv();
    env = loadEnv({
      ...process.env,
      JWT_SECRET: 'e2e-'.padEnd(40, 'x'),
      DISCORD_CLIENT_ID: 'e2e',
      DISCORD_CLIENT_SECRET: 'e2e',
      DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
      PATH_STREAM_DELAY_MS: '60',
    });
    app = await buildApp(env);
    base = `http://127.0.0.1:${((app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
    db = app.get(DataSource);
    await db.runMigrations();
    await seedCatalog(db, catalog);
    alice = await user('test-paths-alice');
    bob = await user('test-paths-bob');
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE discord_id LIKE 'test-paths-%'`);
    await app.close();
  });

  it('genera en streaming: profile → step×N (incremental) → rationale×N → done, y la persiste', async () => {
    const assessmentId = await completedAssessment(alice.id, backend);
    const { status, events } = await generate(alice, {
      assessmentId,
      name: 'Backend con Nest',
    });
    expect(status).toBe(200);

    const kinds = events.map((e) => e.event);
    const n = kinds.filter((k) => k === 'step').length;
    expect(n).toBeGreaterThan(1);
    expect(kinds).toEqual([
      'profile',
      ...Array<string>(n).fill('step'),
      ...Array<string>(n).fill('rationale'),
      'done',
    ]);

    // Criterio 4: los pasos llegan escalonados, no de golpe al final.
    const steps = events.filter((e) => e.event === 'step');
    expect(steps.at(-1)!.at - steps[0].at).toBeGreaterThanOrEqual((n - 1) * 40);

    // Criterio 5: solo cursos del catálogo y prerrequisito antes que su curso.
    const order = steps.map((e) => (e.data as StepData).course.slug);
    const pos = new Map(order.map((s, i) => [s, i]));
    for (const slug of order) {
      const c = catalog.courses.find((x) => x.slug === slug);
      expect(c).toBeDefined();
      for (const pre of c!.prerequisites)
        if (pos.has(pre)) expect(pos.get(pre)!).toBeLessThan(pos.get(slug)!);
    }
    expect(order).not.toContain('javascript-moderno'); // domina JS

    const { pathId } = events.at(-1)!.data as { pathId: string };
    const detail = (
      (
        await http()
          .get(`/v1/paths/${pathId}`)
          .set('Cookie', alice.cookie)
          .expect(200)
      ).body as Data<PathDetail>
    ).data;
    expect(detail.steps.map((s) => s.course.slug)).toEqual(order);
    expect(detail.steps.every((s) => s.rationale.length > 10)).toBe(true);
    expect(detail.progress).toEqual({ completed: 0, total: n });
    const [{ count }] = await db.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM path_steps s JOIN courses c ON c.id = s.course_id WHERE s.path_id = $1`,
      [pathId],
    );
    expect(count).toBe(n);
  });

  it('errores antes del stream salen como JSON: 401, 404 ajena, 409 no completada, 400 nombre', async () => {
    // Usuario propio: estas peticiones también cuentan para el rate limit (5/h por usuario).
    const erin = await user('test-paths-erin');
    const theirs = await completedAssessment(bob.id, backend);
    const inProgress = await completedAssessment(
      erin.id,
      backend,
      'in_progress',
    );
    const noSession = await fetch(`${base}/v1/paths/generate`, {
      method: 'POST',
    });
    expect(noSession.status).toBe(401);
    expect(
      (await generate(erin, { assessmentId: theirs, name: 'x' })).json!.error
        .code,
    ).toBe('ASSESSMENT_NOT_FOUND');
    expect(
      (await generate(erin, { assessmentId: inProgress, name: 'x' })).json!
        .error.code,
    ).toBe('ASSESSMENT_NOT_COMPLETED');
    expect(
      (await generate(erin, { assessmentId: theirs, name: '' })).json!.error
        .code,
    ).toBe('VALIDATION_ERROR');
  });

  it('PATH_NOTHING_TO_LEARN si ya domina todo lo del objetivo', async () => {
    const id = await completedAssessment(alice.id, {
      levels: { javascript: 3, typescript: 3, 'programming-basics': 3 },
      targetSkills: ['typescript'],
    });
    const r = await generate(alice, { assessmentId: id, name: 'Nada' });
    expect(r.status).toBe(400);
    expect(r.json!.error.code).toBe('PATH_NOTHING_TO_LEARN');
  });

  it('si el cliente corta el stream antes de done, no se guarda nada', async () => {
    const id = await completedAssessment(alice.id, backend);
    const before = (
      await db.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1`,
        [alice.id],
      )
    )[0].n;
    await generate(
      alice,
      { assessmentId: id, name: 'Cortada' },
      { abortAfter: (e) => e.event === 'step' },
    );
    await new Promise((r) => setTimeout(r, 1500)); // dejar que el servidor termine lo que tuviera en curso
    const after = (
      await db.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1`,
        [alice.id],
      )
    )[0].n;
    expect(after).toBe(before);
  });

  it('listar, progreso, renombrar, archivar y ownership (criterio 7)', async () => {
    const id = await completedAssessment(alice.id, backend);
    const { events } = await generate(alice, {
      assessmentId: id,
      name: 'Para progreso',
    });
    const pathId = (events.at(-1)!.data as { pathId: string }).pathId;
    const detail = (
      (await http().get(`/v1/paths/${pathId}`).set('Cookie', alice.cookie))
        .body as Data<PathDetail>
    ).data;
    const [s0, s1] = detail.steps;
    const url = (s: { id: string }) =>
      `/v1/paths/${pathId}/steps/${s.id}/completion`;

    const done0 = await http()
      .put(url(s0))
      .set('Cookie', alice.cookie)
      .expect(200);
    expect((done0.body as Data<{ progress: object }>).data.progress).toEqual({
      completed: 1,
      total: detail.steps.length,
    });
    const at = (done0.body as Data<{ step: { completedAt: string } }>).data.step
      .completedAt;
    const again = await http()
      .put(url(s0))
      .set('Cookie', alice.cookie)
      .expect(200);
    expect(
      (again.body as Data<{ step: { completedAt: string } }>).data.step
        .completedAt,
    ).toBe(at); // idempotente
    await http().put(url(s1)).set('Cookie', alice.cookie).expect(200);
    await http().delete(url(s1)).set('Cookie', alice.cookie).expect(200);

    // Persiste tras "recargar".
    const list = (
      (await http().get('/v1/paths').set('Cookie', alice.cookie).expect(200))
        .body as Data<(PathDetail & { progress: object })[]>
    ).data;
    expect(list.find((p) => p.id === pathId)!.progress).toEqual({
      completed: 1,
      total: detail.steps.length,
    });

    const renamed = await http()
      .patch(`/v1/paths/${pathId}`)
      .set('Cookie', alice.cookie)
      .send({ name: 'Nuevo nombre', status: 'archived' })
      .expect(200);
    expect(
      (renamed.body as Data<{ name: string; status: string }>).data,
    ).toMatchObject({ name: 'Nuevo nombre', status: 'archived' });
    expect(
      code(
        await http()
          .patch(`/v1/paths/${pathId}`)
          .set('Cookie', alice.cookie)
          .send({ status: 'borrada' })
          .expect(400),
      ),
    ).toBe('VALIDATION_ERROR');

    // Otro usuario: 404 en todo.
    await http()
      .get(`/v1/paths/${pathId}`)
      .set('Cookie', bob.cookie)
      .expect(404);
    await http().put(url(s0)).set('Cookie', bob.cookie).expect(404);
    await http()
      .patch(`/v1/paths/${pathId}`)
      .set('Cookie', bob.cookie)
      .send({ name: 'mía' })
      .expect(404);
    await http()
      .delete(`/v1/paths/${pathId}`)
      .set('Cookie', bob.cookie)
      .expect(404);
    expect(
      (
        (await http().get('/v1/paths').set('Cookie', bob.cookie)).body as Data<
          unknown[]
        >
      ).data,
    ).toEqual([]);

    // Paso de otra ruta o inexistente.
    expect(
      code(
        await http()
          .put(
            `/v1/paths/${pathId}/steps/00000000-0000-4000-8000-000000000000/completion`,
          )
          .set('Cookie', alice.cookie)
          .expect(404),
      ),
    ).toBe('PATH_STEP_NOT_FOUND');

    await http()
      .delete(`/v1/paths/${pathId}`)
      .set('Cookie', alice.cookie)
      .expect(200);
    expect(
      code(
        await http()
          .get(`/v1/paths/${pathId}`)
          .set('Cookie', alice.cookie)
          .expect(404),
      ),
    ).toBe('PATH_NOT_FOUND');
  });

  it('máximo 10 rutas por usuario', async () => {
    const carol = await user('test-paths-carol');
    const [{ id: courseId }] = await db.query<{ id: string }[]>(
      `SELECT id FROM courses LIMIT 1`,
    );
    for (let i = 0; i < 10; i++) {
      const [{ id }] = await db.query<{ id: string }[]>(
        `INSERT INTO learning_paths (id, user_id, name, goal, status, generated_by)
         VALUES (gen_random_uuid(), $1, $2, '', 'active', 'rules') RETURNING id`,
        [carol.id, `r${i}`],
      );
      await db.query(
        `INSERT INTO path_steps (id, path_id, course_id, position, rationale) VALUES (gen_random_uuid(), $1, $2, 0, '')`,
        [id, courseId],
      );
    }
    const id = await completedAssessment(carol.id, backend);
    const r = await generate(carol, { assessmentId: id, name: 'Once' });
    expect(r.status).toBe(409);
    expect(r.json!.error.code).toBe('PATH_LIMIT_REACHED');
  });

  it('la 6ª generación en una hora responde 429 RATE_LIMITED (criterio 8)', async () => {
    const fresh = await buildApp(env); // contador en memoria propio
    const url = `http://127.0.0.1:${((fresh.getHttpServer() as unknown as Server).address() as AddressInfo).port}/v1/paths/generate`;
    const dave = await user('test-paths-dave');
    const body = {
      assessmentId: '00000000-0000-4000-8000-000000000000',
      name: 'x',
    };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await readStream(url, dave.cookie, body)).status);
    expect(statuses).toEqual([404, 404, 404, 404, 404, 429]);
    const last = await readStream(url, dave.cookie, body);
    expect(last.json!.error.code).toBe('RATE_LIMITED');
    // Es por usuario: otro usuario no está limitado.
    expect((await readStream(url, alice.cookie, body)).status).toBe(404);
    await fresh.close();
  });
});
