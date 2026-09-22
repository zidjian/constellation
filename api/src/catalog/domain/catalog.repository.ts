import type { Catalog } from './catalog';

export const CATALOG_REPOSITORY = Symbol('CatalogRepository');

export interface CatalogRepository {
  load(): Promise<Catalog>;
}
