import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { loadDotEnv, loadEnv } from '../config/env';

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

// Usado por el CLI de TypeORM (migration:generate / run / revert).
loadDotEnv();
export default new DataSource(dataSourceOptions(loadEnv().DATABASE_URL));
