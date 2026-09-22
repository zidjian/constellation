import { Inject, Injectable } from '@nestjs/common';
import type { Catalog } from '../domain/catalog';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../domain/catalog.repository';

@Injectable()
export class GetCatalogUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  execute(): Promise<Catalog> {
    return this.catalog.load();
  }
}
