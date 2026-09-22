import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  LearningPath,
  type PathGeneratedBy,
  type PathStatus,
} from '../domain/learning-path';
import type { LearningPathRepository } from '../domain/ports';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PathRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  name: string;
  goal: string;
  status: PathStatus;
  generated_by: PathGeneratedBy;
  created_at: Date;
};
type StepRow = {
  id: string;
  path_id: string;
  slug: string;
  position: number;
  rationale: string;
  completed_at: Date | null;
};

const PATH_COLUMNS =
  'id, user_id, session_id, name, goal, status, generated_by, created_at';

@Injectable()
export class TypeOrmLearningPathRepository implements LearningPathRepository {
  constructor(private readonly dataSource: DataSource) {}

  newId(): string {
    return randomUUID();
  }

  async countForUser(userId: string): Promise<number> {
    const [{ n }] = await this.dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1`,
      [userId],
    );
    return n;
  }

  async findForUser(id: string, userId: string): Promise<LearningPath | null> {
    if (!UUID.test(id)) return null;
    const rows = await this.dataSource.query<PathRow[]>(
      `SELECT ${PATH_COLUMNS} FROM learning_paths WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (await this.hydrate(rows))[0] ?? null;
  }

  async listForUser(userId: string): Promise<LearningPath[]> {
    const rows = await this.dataSource.query<PathRow[]>(
      `SELECT ${PATH_COLUMNS} FROM learning_paths WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return this.hydrate(rows);
  }

  async create(path: LearningPath): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO learning_paths (id, user_id, session_id, name, goal, status, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          path.id,
          path.userId,
          path.sessionId,
          path.name,
          path.goal,
          path.status,
          path.generatedBy,
        ],
      );
      for (const s of path.steps) {
        const inserted: unknown[] = await tx.query(
          `INSERT INTO path_steps (id, path_id, course_id, position, rationale, completed_at)
           SELECT $1, $2, c.id, $4, $5, $6 FROM courses c WHERE c.slug = $3 RETURNING id`,
          [s.id, path.id, s.courseSlug, s.position, s.rationale, s.completedAt],
        );
        // Invariante: una ruta solo contiene cursos del catálogo.
        if (!insertedRows(inserted))
          throw new Error(`Curso inexistente en la ruta: ${s.courseSlug}`);
      }
    });
  }

  async update(path: LearningPath): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE learning_paths SET name = $3, status = $4, updated_at = now() WHERE id = $1 AND user_id = $2`,
        [path.id, path.userId, path.name, path.status],
      );
      for (const s of path.steps) {
        await tx.query(
          `UPDATE path_steps SET completed_at = $3 WHERE id = $1 AND path_id = $2`,
          [s.id, path.id, s.completedAt],
        );
      }
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const [{ n }] = await this.dataSource.query<{ n: number }[]>(
      `WITH d AS (DELETE FROM learning_paths WHERE id = $1 AND user_id = $2 RETURNING 1)
       SELECT count(*)::int AS n FROM d`,
      [id, userId],
    );
    return n > 0;
  }

  private async hydrate(rows: PathRow[]): Promise<LearningPath[]> {
    if (!rows.length) return [];
    const steps = await this.dataSource.query<StepRow[]>(
      `SELECT s.id, s.path_id, c.slug, s.position, s.rationale, s.completed_at
       FROM path_steps s JOIN courses c ON c.id = s.course_id
       WHERE s.path_id = ANY($1::uuid[]) ORDER BY s.position`,
      [rows.map((r) => r.id)],
    );
    return rows.map((r) =>
      LearningPath.restore({
        id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        name: r.name,
        goal: r.goal,
        status: r.status,
        generatedBy: r.generated_by,
        createdAt: r.created_at,
        steps: steps
          .filter((s) => s.path_id === r.id)
          .map((s) => ({
            id: s.id,
            courseSlug: s.slug,
            position: s.position,
            rationale: s.rationale,
            completedAt: s.completed_at,
          })),
      }),
    );
  }
}

// En Postgres, TypeORM devuelve filas o [filas, conteo] según la sentencia.
function insertedRows(result: unknown[]): number {
  return Array.isArray(result[0])
    ? (result[0] as unknown[]).length
    : result.length;
}
