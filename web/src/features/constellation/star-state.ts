import type { StarState } from "@/components/ui/star";

export interface StarInput {
  slug: string;
  completed: boolean;
}

/** Disponible = todos sus prerrequisitos dentro de la ruta están completados. */
export function starStates(stars: StarInput[], edges: { from: string; to: string }[]): Map<string, StarState> {
  const done = new Set(stars.filter((s) => s.completed).map((s) => s.slug));
  return new Map(
    stars.map((s) => {
      if (s.completed) return [s.slug, "completed" as const];
      const pending = edges.some((e) => e.to === s.slug && !done.has(e.from));
      return [s.slug, pending ? ("locked" as const) : ("available" as const)];
    }),
  );
}

/** Siguiente estrella sugerida: la primera disponible en el orden de la ruta. */
export const nextStar = (orderedSlugs: string[], states: Map<string, StarState>) =>
  orderedSlugs.find((s) => states.get(s) === "available") ?? null;
