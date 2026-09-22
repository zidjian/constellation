import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillProfile } from '../../assessment/domain/skill-profile';
import type { Catalog, Course } from '../../catalog/domain/catalog';
import { CatalogGraph } from '../../catalog/domain/catalog-graph';
import { DomainError } from '../../shared/domain/domain-error';
import { MAX_PATH_STEPS, PathPlanner } from './path-planner';

const course = (slug: string, extra: Partial<Course> = {}): Course => ({
  slug,
  title: slug,
  url: `https://cursos.devtalles.com/courses/${slug}`,
  imageUrl: 'https://img',
  summary: '',
  level: 'beginner',
  durationHours: 10,
  teaches: [slug],
  requires: [],
  prerequisites: [],
  ...extra,
});
const planner = (courses: Course[]) => {
  const skills = [...new Set(courses.flatMap((c) => c.teaches))].map(
    (slug) => ({
      slug,
      name: slug,
      area: 'fundamentals' as const,
    }),
  );
  return new PathPlanner(CatalogGraph.from({ skills, courses }));
};
const profile = (
  targetSkills: string[],
  levels: Record<string, number> = {},
): SkillProfile => ({
  targetSkills,
  levels,
});
const slugs = (p: { steps: { courseSlug: string }[] }) =>
  p.steps.map((s) => s.courseSlug);

// js → ts → nest → graphql ; docker suelto
const stack = [
  course('js'),
  course('ts', { prerequisites: ['js'] }),
  course('nest', { prerequisites: ['ts'], level: 'intermediate' }),
  course('graphql', { prerequisites: ['nest'], level: 'advanced' }),
  course('docker'),
];

describe('PathPlanner', () => {
  it('incluye el cierre transitivo de prerrequisitos en orden', () => {
    expect(slugs(planner(stack).plan(profile(['graphql'])))).toEqual([
      'js',
      'ts',
      'nest',
      'graphql',
    ]);
  });

  it('quita lo que ya domina sin romper el orden del resto', () => {
    const p = planner(stack).plan(profile(['graphql'], { js: 3, ts: 2 }));
    expect(slugs(p)).toEqual(['nest', 'graphql']);
  });

  it('un nivel por debajo del umbral no cuenta como dominado', () => {
    expect(slugs(planner(stack).plan(profile(['ts'], { js: 1 })))).toEqual([
      'js',
      'ts',
    ]);
  });

  it('etiqueta cada paso con su motivo', () => {
    const p = planner(stack).plan(profile(['nest']));
    expect(p.steps).toEqual([
      { courseSlug: 'js', reason: { kind: 'prerequisite', for: ['ts'] } },
      { courseSlug: 'ts', reason: { kind: 'prerequisite', for: ['nest'] } },
      { courseSlug: 'nest', reason: { kind: 'target', skills: ['nest'] } },
    ]);
  });

  it('elige un solo curso por skill: el que menos cursos nuevos añade', () => {
    const p = planner([
      course('base'),
      course('largo', { teaches: ['ia'], prerequisites: ['base'] }),
      course('directo', { teaches: ['ia'], durationHours: 40 }),
    ]).plan(profile(['ia']));
    expect(slugs(p)).toEqual(['directo']);
  });

  it('desempata por nivel, duración y slug', () => {
    const p = planner([
      course('b-corto', { teaches: ['x'], durationHours: 2 }),
      course('a-corto', { teaches: ['x'], durationHours: 2 }),
      course('avanzado', {
        teaches: ['x'],
        level: 'advanced',
        durationHours: 1,
      }),
    ]).plan(profile(['x']));
    expect(slugs(p)).toEqual(['a-corto']);
  });

  it('reutiliza un curso ya elegido si también cubre otro objetivo', () => {
    const p = planner([
      course('full', { teaches: ['a', 'b'] }),
      course('solo-b', { teaches: ['b'] }),
    ]).plan(profile(['a', 'b']));
    expect(p.steps).toEqual([
      { courseSlug: 'full', reason: { kind: 'target', skills: ['a', 'b'] } },
    ]);
  });

  it('ignora e informa las skills objetivo que ningún curso enseña', () => {
    const p = planner(stack).plan(profile(['docker', 'cobol']));
    expect(slugs(p)).toEqual(['docker']);
    expect(p.uncoveredTargets).toEqual(['cobol']);
  });

  it('lanza PATH_NOTHING_TO_LEARN si ya domina todo', () => {
    const run = () => planner(stack).plan(profile(['ts'], { js: 2, ts: 3 }));
    expect(run).toThrow(DomainError);
    expect(run).toThrow(
      expect.objectContaining({ code: 'PATH_NOTHING_TO_LEARN' }) as Error,
    );
  });

  it('recorta a MAX_PATH_STEPS tomando un prefijo cerrado bajo prerrequisitos', () => {
    const chain = Array.from({ length: 20 }, (_, i) =>
      course(`c${String(i).padStart(2, '0')}`, {
        prerequisites: i ? [`c${String(i - 1).padStart(2, '0')}`] : [],
      }),
    );
    const p = planner(chain).plan(profile(['c19']));
    expect(p.steps).toHaveLength(MAX_PATH_STEPS);
    expect(p.truncated).toBe(true);
    expect(slugs(p)[0]).toBe('c00');
  });

  it('es determinista: la misma entrada produce la misma ruta', () => {
    const pl = planner(stack);
    const input = profile(['graphql', 'docker'], { js: 1 });
    expect(pl.plan(input)).toEqual(pl.plan(input));
  });
});

describe('PathPlanner sobre el catálogo real (propiedades)', () => {
  const catalog = JSON.parse(
    readFileSync(
      join(__dirname, '../../catalog/infrastructure/seed/catalog.json'),
      'utf8',
    ),
  ) as Catalog;
  const graph = CatalogGraph.from(catalog);
  const pl = new PathPlanner(graph);
  const skills = catalog.skills.map((s) => s.slug);

  // PRNG con semilla: casos reproducibles.
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const randomProfile = (): SkillProfile => ({
    targetSkills: Array.from(
      { length: 1 + Math.floor(rand() * 3) },
      () => skills[Math.floor(rand() * skills.length)],
    ),
    levels: Object.fromEntries(
      skills.filter(() => rand() < 0.3).map((s) => [s, Math.floor(rand() * 4)]),
    ),
  });

  const assertInvariants = (p: SkillProfile) => {
    let planned;
    try {
      planned = pl.plan(p);
    } catch (e) {
      expect((e as DomainError).code).toBe('PATH_NOTHING_TO_LEARN');
      return;
    }
    const order = slugs(planned);
    const pos = new Map(order.map((s, i) => [s, i]));
    expect(order.length).toBeGreaterThan(0);
    expect(order.length).toBeLessThanOrEqual(MAX_PATH_STEPS);
    expect(new Set(order).size).toBe(order.length);
    for (const slug of order) {
      const c = graph.course(slug);
      expect(c).toBeDefined(); // invariante: solo cursos del catálogo
      for (const pre of c!.prerequisites) {
        if (pos.has(pre)) {
          expect(pos.get(pre)!).toBeLessThan(pos.get(slug)!); // prerrequisito antes
        } else {
          // Si no está en la ruta es porque ya lo domina (el recorte no deja huecos).
          expect(
            graph.course(pre)!.teaches.every((s) => (p.levels[s] ?? 0) >= 2),
          ).toBe(true);
        }
      }
    }
  };

  it.each(skills)(
    'cada skill como objetivo único produce una ruta válida: %s',
    (skill) => {
      assertInvariants({ targetSkills: [skill], levels: {} });
    },
  );

  it('500 perfiles aleatorios cumplen las invariantes', () => {
    for (let i = 0; i < 500; i++) assertInvariants(randomProfile());
  });
});
