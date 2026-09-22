import type { DataSource, EntityManager } from 'typeorm';
import type { Catalog } from '../../domain/catalog';
import { CatalogGraph } from '../../domain/catalog-graph';

export interface SeedReport {
  skills: { inserted: number; updated: number; deleted: number };
  courses: { inserted: number; updated: number; deleted: number };
  courseSkills: { inserted: number; deleted: number };
  prerequisites: { inserted: number; deleted: number };
}

/**
 * Carga el catálogo en una transacción. Idempotente: con el mismo catálogo, una segunda
 * ejecución no escribe nada (upsert solo si cambió, relaciones por diferencia).
 * Lo que ya no está en catalog.json se borra; si una ruta lo referencia, la FK lo impide y el seed falla.
 */
export async function seedCatalog(
  dataSource: DataSource,
  catalog: Catalog,
): Promise<SeedReport> {
  // Falla antes de tocar la BD si hay ciclos o referencias rotas.
  CatalogGraph.from(catalog);

  return dataSource.transaction(async (tx) => {
    const skills = await upsertSkills(tx, catalog);
    const courses = await upsertCourses(tx, catalog);

    const skillIds = await idsBySlug(tx, 'skills');
    const courseIds = await idsBySlug(tx, 'courses');

    const wantedSkills = new Set(
      catalog.courses.flatMap((c) => [
        ...c.teaches.map(
          (s) => `${courseIds.get(c.slug)}|${skillIds.get(s)}|teaches`,
        ),
        ...c.requires.map(
          (s) => `${courseIds.get(c.slug)}|${skillIds.get(s)}|requires`,
        ),
      ]),
    );
    const courseSkills = await reconcile(
      tx,
      'course_skills',
      ['course_id', 'skill_id', 'relation'],
      wantedSkills,
    );

    const wantedPrereqs = new Set(
      catalog.courses.flatMap((c) =>
        c.prerequisites.map(
          (p) => `${courseIds.get(c.slug)}|${courseIds.get(p)}`,
        ),
      ),
    );
    const prerequisites = await reconcile(
      tx,
      'course_prerequisites',
      ['course_id', 'prerequisite_id'],
      wantedPrereqs,
    );

    return { skills, courses, courseSkills, prerequisites };
  });
}

async function upsertSkills(tx: EntityManager, catalog: Catalog) {
  let inserted = 0;
  let updated = 0;
  for (const s of catalog.skills) {
    const rows: { inserted: boolean }[] = await tx.query(
      `INSERT INTO skills (slug, name, area) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, area = EXCLUDED.area, updated_at = now()
       WHERE (skills.name, skills.area) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.area)
       RETURNING (xmax = 0) AS inserted`,
      [s.slug, s.name, s.area],
    );
    if (rows.length && rows[0].inserted) inserted++;
    else if (rows.length) updated++;
  }
  const deleted = await deleteMissing(
    tx,
    'skills',
    catalog.skills.map((s) => s.slug),
  );
  return { inserted, updated, deleted };
}

async function upsertCourses(tx: EntityManager, catalog: Catalog) {
  let inserted = 0;
  let updated = 0;
  for (const c of catalog.courses) {
    const rows: { inserted: boolean }[] = await tx.query(
      `INSERT INTO courses (slug, title, url, image_url, summary, level, duration_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, url = EXCLUDED.url, image_url = EXCLUDED.image_url,
         summary = EXCLUDED.summary, level = EXCLUDED.level,
         duration_hours = EXCLUDED.duration_hours, updated_at = now()
       WHERE (courses.title, courses.url, courses.image_url, courses.summary, courses.level, courses.duration_hours)
         IS DISTINCT FROM
         (EXCLUDED.title, EXCLUDED.url, EXCLUDED.image_url, EXCLUDED.summary, EXCLUDED.level, EXCLUDED.duration_hours)
       RETURNING (xmax = 0) AS inserted`,
      [c.slug, c.title, c.url, c.imageUrl, c.summary, c.level, c.durationHours],
    );
    if (rows.length && rows[0].inserted) inserted++;
    else if (rows.length) updated++;
  }
  const deleted = await deleteMissing(
    tx,
    'courses',
    catalog.courses.map((c) => c.slug),
  );
  return { inserted, updated, deleted };
}

async function deleteMissing(
  tx: EntityManager,
  table: 'skills' | 'courses',
  slugs: string[],
): Promise<number> {
  // CTE: en Postgres, TypeORM devuelve [filas, conteo] para DELETE ... RETURNING; así se obtiene un número limpio.
  const [{ n }]: { n: number }[] = await tx.query(
    `WITH d AS (DELETE FROM ${table} WHERE NOT (slug = ANY($1::text[])) RETURNING 1) SELECT count(*)::int AS n FROM d`,
    [slugs],
  );
  return n;
}

async function idsBySlug(tx: EntityManager, table: 'skills' | 'courses') {
  const rows: { id: string; slug: string }[] = await tx.query(
    `SELECT id, slug FROM ${table}`,
  );
  return new Map(rows.map((r) => [r.slug, r.id]));
}

// Inserta las filas deseadas que faltan y borra las que sobran. Las claves van como "a|b|c".
async function reconcile(
  tx: EntityManager,
  table: 'course_skills' | 'course_prerequisites',
  columns: string[],
  wanted: Set<string>,
) {
  const cols = columns.join(', ');
  const rows: Record<string, string>[] = await tx.query(
    `SELECT ${cols} FROM ${table}`,
  );
  const existing = new Set(rows.map((r) => columns.map((c) => r[c]).join('|')));

  const toInsert = [...wanted].filter((k) => !existing.has(k));
  const toDelete = [...existing].filter((k) => !wanted.has(k));

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const where = columns.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
  for (const key of toInsert)
    await tx.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      key.split('|'),
    );
  for (const key of toDelete)
    await tx.query(`DELETE FROM ${table} WHERE ${where}`, key.split('|'));

  return { inserted: toInsert.length, deleted: toDelete.length };
}
