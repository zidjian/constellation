import { DomainError } from '../../shared/domain/domain-error';
import type { Catalog, Course } from './catalog';

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/**
 * Grafo de prerrequisitos del catálogo. Garantiza al construirse que es un DAG con referencias
 * válidas: es la base de la invariante "el orden de una ruta respeta los prerrequisitos".
 */
export class CatalogGraph {
  private readonly bySlug: ReadonlyMap<string, Course>;

  private constructor(readonly catalog: Catalog) {
    this.bySlug = new Map(catalog.courses.map((c) => [c.slug, c]));
  }

  static from(catalog: Catalog): CatalogGraph {
    const graph = new CatalogGraph(catalog);
    graph.assertValid();
    return graph;
  }

  course(slug: string): Course | undefined {
    return this.bySlug.get(slug);
  }

  has(slug: string): boolean {
    return this.bySlug.has(slug);
  }

  /** Cierre transitivo de prerrequisitos de `slugs`, sin incluirlos a ellos. */
  prerequisiteClosure(slugs: Iterable<string>): Set<string> {
    const result = new Set<string>();
    const stack = [...slugs].flatMap(
      (s) => this.bySlug.get(s)?.prerequisites ?? [],
    );
    while (stack.length) {
      const slug = stack.pop()!;
      if (result.has(slug)) continue;
      result.add(slug);
      stack.push(...(this.bySlug.get(slug)?.prerequisites ?? []));
    }
    return result;
  }

  /**
   * Orden topológico estable de `slugs` (Kahn), considerando solo aristas entre ellos.
   * Desempate determinista: nivel, luego duración, luego slug por punto de código.
   */
  topologicalOrder(slugs: Iterable<string>): string[] {
    const subset = new Set(slugs);
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const slug of subset) {
      indegree.set(slug, 0);
      dependents.set(slug, []);
    }
    for (const slug of subset) {
      for (const pre of this.bySlug.get(slug)?.prerequisites ?? []) {
        if (!subset.has(pre)) continue;
        indegree.set(slug, indegree.get(slug)! + 1);
        dependents.get(pre)!.push(slug);
      }
    }
    const ready = [...subset].filter((s) => indegree.get(s) === 0);
    const order: string[] = [];
    while (ready.length) {
      ready.sort((a, b) => this.compare(a, b));
      const next = ready.shift()!;
      order.push(next);
      for (const dep of dependents.get(next)!) {
        indegree.set(dep, indegree.get(dep)! - 1);
        if (indegree.get(dep) === 0) ready.push(dep);
      }
    }
    return order;
  }

  private compare(a: string, b: string): number {
    const ca = this.bySlug.get(a)!;
    const cb = this.bySlug.get(b)!;
    return (
      LEVEL_RANK[ca.level] - LEVEL_RANK[cb.level] ||
      ca.durationHours - cb.durationHours ||
      (a < b ? -1 : a > b ? 1 : 0)
    );
  }

  private assertValid(): void {
    const skills = new Set(this.catalog.skills.map((s) => s.slug));
    if (skills.size !== this.catalog.skills.length)
      throw invalid('slugs de skill duplicados');
    if (this.bySlug.size !== this.catalog.courses.length)
      throw invalid('slugs de curso duplicados');

    for (const c of this.catalog.courses) {
      for (const s of [...c.teaches, ...c.requires]) {
        if (!skills.has(s))
          throw invalid(`${c.slug} referencia la skill inexistente ${s}`);
      }
      for (const p of c.prerequisites) {
        if (p === c.slug)
          throw invalid(`${c.slug} es prerrequisito de sí mismo`);
        if (!this.bySlug.has(p))
          throw invalid(`${c.slug} tiene el prerrequisito inexistente ${p}`);
      }
    }

    const cycle = this.findCycle();
    if (cycle) throw invalid(`ciclo en prerrequisitos: ${cycle.join(' → ')}`);
  }

  private findCycle(): string[] | null {
    const state = new Map<string, 'visiting' | 'done'>();
    const path: string[] = [];
    const visit = (slug: string): string[] | null => {
      if (state.get(slug) === 'done') return null;
      if (state.get(slug) === 'visiting')
        return [...path.slice(path.indexOf(slug)), slug];
      state.set(slug, 'visiting');
      path.push(slug);
      for (const pre of this.bySlug.get(slug)!.prerequisites) {
        const found = visit(pre);
        if (found) return found;
      }
      path.pop();
      state.set(slug, 'done');
      return null;
    };
    for (const slug of this.bySlug.keys()) {
      const found = visit(slug);
      if (found) return found;
    }
    return null;
  }
}

function invalid(detail: string): DomainError {
  return new DomainError(
    'CATALOG_INVALID',
    `Catálogo inválido: ${detail}`,
    'validation',
  );
}
