import { Star } from "@/components/ui/star";
import type { Progress } from "./types";

/** Progreso como fila de estrellas (máx. 15 = tope de pasos): se cuenta y se ve de un vistazo. */
export function StarRow({ progress, size = 14 }: { progress: Progress; size?: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-hidden>
      {Array.from({ length: progress.total }, (_, i) => (
        <Star key={i} state={i < progress.completed ? "completed" : "locked"} size={size} />
      ))}
    </span>
  );
}

export const progressLabel = (p: Progress) =>
  p.completed === p.total
    ? `Completa: ${p.total} de ${p.total} estrellas`
    : `${p.completed} de ${p.total} ${p.total === 1 ? "estrella encendida" : "estrellas encendidas"}`;
