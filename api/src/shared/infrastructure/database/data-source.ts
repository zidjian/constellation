import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

export function dataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    // Invariante: el esquema solo cambia por migración, también en local.
    synchronize: false,
    // gen_random_uuid() es nativo desde Postgres 13; evita depender de la extensión uuid-ossp.
    uuidExtension: 'pgcrypto',
    migrationsRun: false,
    entities: [join(__dirname, '../../../**/*.orm-entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  };
}
