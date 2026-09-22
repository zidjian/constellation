import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

export function dataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    // Invariante: el esquema solo cambia por migración, también en local.
    synchronize: false,
    migrationsRun: false,
    entities: [join(__dirname, '../../../**/*.orm-entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  };
}
