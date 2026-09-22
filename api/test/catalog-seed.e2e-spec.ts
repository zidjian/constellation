import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import type { Catalog } from '../src/catalog/domain/catalog';
import { parseCatalogFile } from '../src/catalog/infrastructure/seed/catalog-file.schema';
import { seedCatalog } from '../src/catalog/infrastructure/seed/catalog-seeder';
import { TypeOrmCatalogRepository } from '../src/catalog/infrastructure/persistence/typeorm-catalog.repository';
import { loadDotEnv, loadEnv } from '../src/shared/infrastructure/config/env';
import { dataSourceOptions } from '../src/shared/infrastructure/database/data-source';

// Contra Postgres real (DATABASE_URL). En CI lo levanta el servicio postgres del job.
const catalogPath = join(
  __dirname,
  '../src/catalog/infrastructure/seed/catalog.json',
);

const sorted = (catalog: Catalog) => ({
  skills: [...catalog.skills].sort((a, b) => (a.slug < b.slug ? -1 : 1)),
  courses: [...catalog.courses]
    .map((c) => ({
      ...c,
      teaches: [...c.teaches].sort(),
      requires: [...c.requires].sort(),
      prerequisites: [...c.prerequisites].sort(),
    }))
    .sort((a, b) => (a.slug < b.slug ? -1 : 1)),
});

describe('Seed del catálogo (e2e, Postgres)', () => {
  let dataSource: DataSource;
  const catalog = parseCatalogFile(
    JSON.parse(readFileSync(catalogPath, 'utf8')),
  );

  beforeAll(async () => {
    loadDotEnv();
    dataSource = await new DataSource(
      dataSourceOptions(loadEnv().DATABASE_URL),
    ).initialize();
    await dataSource.runMigrations();
  });

  afterAll(() => dataSource?.destroy());

  it('es idempotente: la segunda ejecución no escribe nada', async () => {
    await seedCatalog(dataSource, catalog);
    const second = await seedCatalog(dataSource, catalog);
    expect(second).toEqual({
      skills: { inserted: 0, updated: 0, deleted: 0 },
      courses: { inserted: 0, updated: 0, deleted: 0 },
      courseSkills: { inserted: 0, deleted: 0 },
      prerequisites: { inserted: 0, deleted: 0 },
    });
  });

  it('el repositorio devuelve exactamente lo que dice catalog.json', async () => {
    const loaded = await new TypeOrmCatalogRepository(dataSource).load();
    const { skills, courses } = catalog;
    expect(sorted(loaded)).toEqual(sorted({ skills, courses }));
  });

  it('rechaza un catálogo con ciclo sin tocar la BD', async () => {
    const [a, b] = catalog.courses;
    const cyclic: Catalog = {
      skills: catalog.skills,
      courses: [
        { ...a, prerequisites: [b.slug] },
        { ...b, prerequisites: [a.slug] },
        ...catalog.courses.slice(2),
      ],
    };
    await expect(seedCatalog(dataSource, cyclic)).rejects.toThrow(/ciclo/);
    const [{ n }] = await dataSource.query<{ n: number }[]>(
      'SELECT count(*)::int AS n FROM courses',
    );
    expect(n).toBe(catalog.courses.length);
  });
});
