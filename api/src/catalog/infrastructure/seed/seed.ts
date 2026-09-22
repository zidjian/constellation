import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { loadDotEnv, loadEnv } from '../../../shared/infrastructure/config/env';
import { dataSourceOptions } from '../../../shared/infrastructure/database/data-source';
import { parseCatalogFile } from './catalog-file.schema';
import { seedCatalog } from './catalog-seeder';

// pnpm seed (local, ts-node) · pnpm seed:prod (servidor, dist/). catalog.json se copia a dist como asset.
async function main() {
  loadDotEnv();
  const catalog = parseCatalogFile(
    JSON.parse(readFileSync(join(__dirname, 'catalog.json'), 'utf8')),
  );
  const dataSource = await new DataSource(
    dataSourceOptions(loadEnv().DATABASE_URL),
  ).initialize();
  try {
    const report = await seedCatalog(dataSource, catalog);
    console.log(
      `Catálogo ${catalog.version} sembrado:`,
      JSON.stringify(report),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
