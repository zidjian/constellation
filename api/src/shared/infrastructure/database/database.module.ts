import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => dataSourceOptions(env.DATABASE_URL),
    }),
  ],
})
export class DatabaseModule {}
