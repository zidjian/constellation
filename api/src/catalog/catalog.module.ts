import { Module } from '@nestjs/common';
import { GetCatalogUseCase } from './application/get-catalog.use-case';
import { CATALOG_REPOSITORY } from './domain/catalog.repository';
import { TypeOrmCatalogRepository } from './infrastructure/persistence/typeorm-catalog.repository';
import { CatalogController } from './presentation/catalog.controller';

@Module({
  controllers: [CatalogController],
  providers: [
    GetCatalogUseCase,
    { provide: CATALOG_REPOSITORY, useClass: TypeOrmCatalogRepository },
  ],
  exports: [CATALOG_REPOSITORY],
})
export class CatalogModule {}
