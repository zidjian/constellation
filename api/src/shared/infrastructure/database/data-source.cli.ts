import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadDotEnv, loadEnv } from '../config/env';
import { dataSourceOptions } from './data-source';

// Entrada exclusiva del CLI de TypeORM (migration:generate / run / revert). La app no la importa.
loadDotEnv();
export default new DataSource(dataSourceOptions(loadEnv().DATABASE_URL));
