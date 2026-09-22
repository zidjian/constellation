import type { Course } from '../../catalog/domain/catalog';
import type { CatalogGraph } from '../../catalog/domain/catalog-graph';
import type { LearningPath, Progress } from '../domain/learning-path';

export interface CourseView {
  slug: string;
  title: string;
  url: string;
  imageUrl: string;
  summary: string;
  level: Course['level'];
  durationHours: number;
}

export const courseView = (c: Course): CourseView => ({
  slug: c.slug,
  title: c.title,
  url: c.url,
  imageUrl: c.imageUrl,
  summary: c.summary,
  level: c.level,
  durationHours: c.durationHours,
});

export interface PathSummary {
  id: string;
  name: string;
  goal: string;
  status: LearningPath['status'];
  generatedBy: LearningPath['generatedBy'];
  createdAt: string;
  progress: Progress;
}

export const pathSummary = (p: LearningPath): PathSummary => ({
  id: p.id,
  name: p.name,
  goal: p.goal,
  status: p.status,
  generatedBy: p.generatedBy,
  createdAt: p.createdAt.toISOString(),
  progress: p.progress,
});

/** Aristas de prerrequisito entre cursos de la ruta: lo que dibuja la constelación. */
export function pathEdges(slugs: string[], graph: CatalogGraph) {
  const inPath = new Set(slugs);
  return slugs.flatMap((to) =>
    (graph.course(to)?.prerequisites ?? [])
      .filter((from) => inPath.has(from))
      .map((from) => ({ from, to })),
  );
}

export function pathDetail(p: LearningPath, graph: CatalogGraph) {
  const slugs = p.steps.map((s) => s.courseSlug);
  return {
    ...pathSummary(p),
    steps: p.steps.map((s) => {
      const course = graph.course(s.courseSlug);
      return {
        id: s.id,
        position: s.position,
        rationale: s.rationale,
        completedAt: s.completedAt?.toISOString() ?? null,
        course: course ? courseView(course) : null,
      };
    }),
    edges: pathEdges(slugs, graph),
  };
}
