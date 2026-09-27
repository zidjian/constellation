// Estrella de la constelación. El estado se distingue por forma además de color (WCAG 1.4.1):
//   completed → disco ámbar con check · available → aro azul con núcleo · locked → aro punteado apagado
// Sobre carbón el ámbar es la única luz: el disco no lleva borde, el brillo lo da `glow`.
export type StarState = "completed" | "available" | "locked";

export const STAR_LABEL: Record<StarState, string> = {
  completed: "Completado",
  available: "Disponible",
  locked: "Con prerrequisitos pendientes",
};

export function Star({ state, size = 28, glow = false }: { state: StarState; size?: number; glow?: boolean }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className="shrink-0 overflow-visible"
      style={glow && state === "completed" ? { filter: "drop-shadow(0 0 6px var(--color-glow))" } : undefined}
    >
      {state === "completed" && (
        <>
          <circle cx="14" cy="14" r="12" fill="var(--color-primary)" />
          <path
            d="M9 14.5l3.2 3.2L19 11"
            fill="none"
            stroke="var(--color-ink-inverse)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {state === "available" && (
        <>
          <circle cx="14" cy="14" r="11.5" fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth="2.5" />
          <circle cx="14" cy="14" r="4" fill="var(--color-accent)" />
        </>
      )}
      {state === "locked" && (
        <circle cx="14" cy="14" r="11.5" fill="var(--color-bg)" stroke="var(--color-star-off)" strokeWidth="2" strokeDasharray="3.5 3" />
      )}
    </svg>
  );
}
