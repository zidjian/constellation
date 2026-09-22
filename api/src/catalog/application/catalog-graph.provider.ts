import { Inject, Injectable } from '@nestjs/common';
import { CatalogGraph } from '../domain/catalog-graph';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../domain/catalog.repository';

/**
 * Grafo del catálogo para otros contextos (entrevista, planner). Se carga una vez por proceso:
 * el catálogo solo cambia con el seed, que corre en el deploy antes de recargar PM2.
 */
@Injectable()
export class CatalogGraphProvider {
  private graph: Promise<CatalogGraph> | null = null;

  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  get(): Promise<CatalogGraph> {
    this.graph ??= this.catalog.load().then((c) => CatalogGraph.from(c));
    this.graph.catch(() => (this.graph = null)); // no cachear un fallo
    return this.graph;
  }
}
