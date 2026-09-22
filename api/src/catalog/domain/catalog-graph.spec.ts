import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DomainError } from '../../shared/domain/domain-error';
import type { Catalog, Course } from './catalog';
import { CatalogGraph } from './catalog-graph';

const course = (slug: string, extra: Partial<Course> = {}): Course => ({
  slug,
  title: slug,
  url: `https://cursos.devtalles.com/courses/${slug}`,
  imageUrl: 'https://img',
  summary: '',
  level: 'beginner',
  durationHours: 1,
  teaches: ['js'],
  requires: [],
  prerequisites: [],
  ...extra,
});
const catalog = (courses: Course[]): Catalog => ({
  skills: [{ slug: 'js', name: 'JS', area: 'fundamentals' }],
  courses,
});

const realCatalog = JSON.parse(
  readFileSync(join(__dirname, '../infrastructure/seed/catalog.json'), 'utf8'),
) as Catalog;

describe('CatalogGraph', () => {
  it('acepta el catálogo real (DAG con referencias válidas)', () => {
    expect(() => CatalogGraph.from(realCatalog)).not.toThrow();
  });

  it('rechaza ciclos indicando el recorrido', () => {
    const cyclic = catalog([
      course('a', { prerequisites: ['c'] }),
      course('b', { prerequisites: ['a'] }),
      course('c', { prerequisites: ['b'] }),
    ]);
    expect(() => CatalogGraph.from(cyclic)).toThrow(
      /ciclo en prerrequisitos: .*→/,
    );
  });

  it.each([
    ['prerrequisito inexistente', [course('a', { prerequisites: ['x'] })]],
    ['autoprerrequisito', [course('a', { prerequisites: ['a'] })]],
    ['skill inexistente', [course('a', { teaches: ['python'] })]],
    ['curso duplicado', [course('a'), course('a')]],
  ])('rechaza %s con CATALOG_INVALID', (_, courses) => {
    try {
      CatalogGraph.from(catalog(courses));
      fail('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CATALOG_INVALID');
    }
  });

  it('calcula el cierre transitivo de prerrequisitos', () => {
    const g = CatalogGraph.from(
      catalog([
        course('js'),
        course('ts', { prerequisites: ['js'] }),
        course('nest', { prerequisites: ['ts'] }),
        course('otro'),
      ]),
    );
    expect([...g.prerequisiteClosure(['nest'])].sort()).toEqual(['js', 'ts']);
  });

  it('ordena topológicamente con desempate por nivel, duración y slug', () => {
    const g = CatalogGraph.from(
      catalog([
        course('z-corto', { durationHours: 1 }),
        course('a-largo', { durationHours: 9 }),
        course('avanzado', { level: 'advanced', durationHours: 1 }),
        course('final', { prerequisites: ['z-corto', 'a-largo', 'avanzado'] }),
      ]),
    );
    expect(
      g.topologicalOrder(['final', 'avanzado', 'a-largo', 'z-corto']),
    ).toEqual(['z-corto', 'a-largo', 'avanzado', 'final']);
  });

  it('en el catálogo real, todo prerrequisito queda antes que su curso', () => {
    const g = CatalogGraph.from(realCatalog);
    const all = realCatalog.courses.map((c) => c.slug);
    const order = g.topologicalOrder(all);
    const pos = new Map(order.map((s, i) => [s, i]));
    expect(order).toHaveLength(all.length);
    for (const c of realCatalog.courses) {
      for (const p of c.prerequisites)
        expect(pos.get(p)!).toBeLessThan(pos.get(c.slug)!);
    }
  });
});
