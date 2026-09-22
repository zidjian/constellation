import { Module } from '@nestjs/common';
import { CatalogGraphProvider } from './application/catalog-graph.provider';
import { GetCatalogUseCase } from './application/get-catalog.use-case';
import { CATALOG_REPOSITORY } from './domain/catalog.repository';
import { TypeOrmCatalogRepository } from './infrastructure/persistence/typeorm-catalog.repository';
import { CatalogController } from './presentation/catalog.controller';

@Module({
  controllers: [CatalogController],
  providers: [
    GetCatalogUseCase,
    CatalogGraphProvider,
    { provide: CATALOG_REPOSITORY, useClass: TypeOrmCatalogRepository },
  ],
  exports: [CATALOG_REPOSITORY, CatalogGraphProvider],
})
export class CatalogModule {}
