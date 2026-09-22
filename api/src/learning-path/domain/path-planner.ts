import {
  isMastered,
  type SkillProfile,
} from '../../assessment/domain/skill-profile';
import type { Course } from '../../catalog/domain/catalog';
import type { CatalogGraph } from '../../catalog/domain/catalog-graph';
import { DomainError } from '../../shared/domain/domain-error';

export const MAX_PATH_STEPS = 15;

export type StepReason =
  | { kind: 'target'; skills: string[] }
  | { kind: 'prerequisite'; for: string[] };

export interface PlannedStep {
  courseSlug: string;
  reason: StepReason;
}

export interface PlannedPath {
  steps: PlannedStep[];
  /** Skills objetivo que ningún curso del catálogo enseña (se ignoran, pero se informan). */
  uncoveredTargets: string[];
  /** true si se recortó a MAX_PATH_STEPS. */
  truncated: boolean;
}

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Motor determinista de rutas (ADR-0001). Única pieza que decide qué cursos entran:
 *   1. skills objetivo → un curso que las enseñe (el más barato de cursar)
 *   2. cierre transitivo de prerrequisitos
 *   3. quitar cursos cuyas skills ya domina
 *   4. orden topológico estable
 *   5. tope de MAX_PATH_STEPS (prefijo del orden: sigue cerrado bajo prerrequisitos)
 * Misma entrada ⇒ misma salida.
 */
export class PathPlanner {
  constructor(private readonly graph: CatalogGraph) {}

  plan(profile: SkillProfile): PlannedPath {
    const mastered = (c: Course) =>
      c.teaches.length > 0 && c.teaches.every((s) => isMastered(profile, s));

    // 1. Un curso por skill objetivo (en orden de prioridad, sin duplicados).
    const targets = [...new Set(profile.targetSkills)];
    const selected = new Set<string>();
    const targetOf = new Map<string, string[]>();
    const uncoveredTargets: string[] = [];
    for (const skill of targets) {
      const candidates = this.graph.catalog.courses.filter((c) =>
        c.teaches.includes(skill),
      );
      if (!candidates.length) {
        uncoveredTargets.push(skill);
        continue;
      }
      const chosen = candidates
        .map((c) => ({ c, cost: this.extraCost(c.slug, selected, mastered) }))
        .sort(
          (a, b) =>
            a.cost - b.cost ||
            LEVEL_RANK[a.c.level] - LEVEL_RANK[b.c.level] ||
            a.c.durationHours - b.c.durationHours ||
            byCodePoint(a.c.slug, b.c.slug),
        )[0].c;
      selected.add(chosen.slug);
      targetOf.set(chosen.slug, [...(targetOf.get(chosen.slug) ?? []), skill]);
    }

    // 2. Cierre de prerrequisitos y 3. quitar lo dominado.
    const all = new Set([
      ...selected,
      ...this.graph.prerequisiteClosure(selected),
    ]);
    const toLearn = [...all].filter(
      (slug) => !mastered(this.graph.course(slug)!),
    );
    if (!toLearn.length) {
      throw new DomainError(
        'PATH_NOTHING_TO_LEARN',
        'Ya dominas todo lo necesario para ese objetivo. Prueba con un objetivo más ambicioso.',
        'validation',
      );
    }

    // 4. Orden topológico y 5. tope.
    const order = this.graph.topologicalOrder(toLearn);
    const kept = order.slice(0, MAX_PATH_STEPS);
    const keptSet = new Set(kept);

    const steps = kept.map((slug): PlannedStep => {
      const skills = targetOf.get(slug);
      if (skills)
        return { courseSlug: slug, reason: { kind: 'target', skills } };
      const dependents = kept.filter(
        (other) =>
          other !== slug &&
          this.graph.course(other)!.prerequisites.includes(slug),
      );
      return {
        courseSlug: slug,
        reason: {
          kind: 'prerequisite',
          for: dependents.filter((d) => keptSet.has(d)),
        },
      };
    });

    return { steps, uncoveredTargets, truncated: order.length > kept.length };
  }

  /** Cursos nuevos que añadiría elegir `slug`: él y su cierre, sin lo ya elegido ni lo dominado. */
  private extraCost(
    slug: string,
    selected: Set<string>,
    mastered: (c: Course) => boolean,
  ): number {
    const covered = new Set([
      ...selected,
      ...this.graph.prerequisiteClosure(selected),
    ]);
    return [slug, ...this.graph.prerequisiteClosure([slug])].filter(
      (s) => !covered.has(s) && !mastered(this.graph.course(s)!),
    ).length;
  }
}
