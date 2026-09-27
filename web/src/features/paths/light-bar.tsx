import type { Progress } from "./types";

/**
 * Barra de luz: un segmento por paso, y se encienden en ámbar al completarlos. No es una barra de
 * progreso genérica, es el recorrido: se ve cuántos pasos quedan y cuánto llevas de un vistazo.
 */
export function LightBar({ progress, className = "" }: { progress: Progress; className?: string }) {
  return (
    <span aria-hidden className={`flex h-1.5 w-full gap-1 ${className}`}>
      {Array.from({ length: Math.max(progress.total, 1) }, (_, i) => (
        <span
          key={i}
          className={
            "h-full flex-1 rounded-full transition-[background-color,box-shadow] duration-300 ease-out-quint " +
            (i < progress.completed
              ? "bg-primary shadow-[0_0_10px_var(--color-glow)]"
              : "bg-line")
          }
        />
      ))}
    </span>
  );
}

export const hoursLabel = (hours: number) => `${hours.toString().replace(".", ",")} h`;

export const progressLabel = (p: Progress) =>
  p.total > 0 && p.completed === p.total
    ? `Ruta completa: ${p.total} de ${p.total} estrellas`
    : `${p.completed} de ${p.total} ${p.total === 1 ? "estrella encendida" : "estrellas encendidas"}`;
