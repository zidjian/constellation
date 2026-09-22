// Ilustración del hero: una ruta real del catálogo (JS → TS → Nest → GraphQL, con Docker aparte),
// dos estrellas encendidas. El trazo se dibuja al cargar, pero la figura es visible sin animación.
// labelDy: posición vertical de la etiqueta (arriba o abajo) para que no cruce ninguna línea.
const STARS = [
  { x: 80, y: 215, label: "JavaScript Moderno", state: "done", labelDy: 38 },
  { x: 175, y: 115, label: "TypeScript", state: "done", labelDy: -30 },
  { x: 295, y: 170, label: "NestJS", state: "next", labelDy: 42 },
  { x: 410, y: 70, label: "Nest + GraphQL", state: "off", labelDy: -28 },
  { x: 410, y: 250, label: "Docker", state: "off", labelDy: 36 },
] as const;
const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
] as const;

export function HeroConstellation() {
  return (
    <svg viewBox="0 0 490 300" role="img" aria-labelledby="hero-cst-title" className="h-auto w-full max-w-[34rem]">
      <title id="hero-cst-title">
        Ejemplo de ruta: JavaScript y TypeScript completados, NestJS es la siguiente estrella; después GraphQL y Docker.
      </title>
      {LINKS.map(([a, b], i) => {
        const from = STARS[a];
        const to = STARS[b];
        const lit = from.state === "done";
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={lit ? "var(--color-accent)" : "var(--color-line-strong)"}
            strokeWidth={lit ? 2.5 : 1.75}
            strokeLinecap="round"
            pathLength={1}
            className="hero-trace"
            style={{ animationDelay: `${120 + i * 140}ms` }}
          />
        );
      })}
      {STARS.map((s) => (
        <g key={s.label} transform={`translate(${s.x} ${s.y})`}>
          {s.state === "done" && (
            <>
              <circle r="15" fill="var(--color-primary)" stroke="var(--color-primary-strong)" strokeWidth="1.5" style={{ filter: "drop-shadow(0 0 8px var(--color-glow))" }} />
              <path d="M-6 0.5l4 4 8.5-8.5" fill="none" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {s.state === "next" && (
            <>
              <circle r="21" fill="none" stroke="var(--color-accent)" strokeOpacity="0.25" strokeWidth="6" className="hero-halo" />
              <circle r="14" fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth="3" />
              <circle r="5" fill="var(--color-accent)" />
            </>
          )}
          {s.state === "off" && <circle r="13" fill="var(--color-bg)" stroke="var(--color-star-off)" strokeWidth="2" strokeDasharray="4 3.5" />}
          <text
            y={s.labelDy}
            textAnchor="middle"
            className="fill-ink text-[13px] font-medium"
            style={{ fill: s.state === "off" ? "var(--color-ink-muted)" : undefined }}
          >
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
