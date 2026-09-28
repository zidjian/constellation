"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChevronLeft, ChevronRight, RotateCcw, Search, SearchX } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Star } from "@/components/ui/star";
import { hoursLabel } from "@/features/paths/light-bar";
import { LEVEL_LABEL, type Course } from "@/features/paths/types";

export interface Skill {
  slug: string;
  name: string;
  area: "fundamentals" | "frontend" | "backend" | "mobile" | "devops";
}

type CatalogCourse = Course & { teaches: string[] };

const AREA_LABEL: Record<Skill["area"], string> = {
  fundamentals: "Fundamentos",
  frontend: "Frontend",
  backend: "Backend",
  mobile: "Móvil",
  devops: "DevOps",
};

const LEVELS: Course["level"][] = ["beginner", "intermediate", "advanced"];

const ESTADOS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "pendientes", etiqueta: "Me faltan" },
  { valor: "terminados", etiqueta: "Terminados" },
] as const;

type Estado = (typeof ESTADOS)[number]["valor"];

/** 12 llenan tres filas de cuatro en escritorio y no obligan a un scroll eterno en móvil. */
const POR_PAGINA = 12;

/** Quita tildes y pasa a minúsculas: buscar "programacion" encuentra "programación". */
const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        "rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ease-out-quint " +
        (activo
          ? "border-accent bg-accent-soft text-ink"
          : "border-line bg-surface/40 text-ink-muted hover:border-line-strong hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

/**
 * Un grupo de filtros con su nombre visible. Las tres familias —área, nivel y estado— eran una
 * sola hilera de cápsulas separadas por una rayita: nada decía cuáles suman entre sí y cuál es
 * excluyente, ni qué significaba cada cápsula suelta.
 */
function GrupoFiltro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
        {titulo}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function CatalogBrowser({
  courses,
  skills,
  completed,
}: {
  courses: CatalogCourse[];
  skills: Skill[];
  /** Slugs de los cursos que la persona ya encendió en alguna ruta. */
  completed: string[];
}) {
  const buscarId = useId();
  const [texto, setTexto] = useState("");
  const [areas, setAreas] = useState<Skill["area"][]>([]);
  const [niveles, setNiveles] = useState<Course["level"][]>([]);
  const [estado, setEstado] = useState<Estado>("todos");
  const [pagina, setPagina] = useState(1);
  const busqueda = useDeferredValue(texto);
  const reduce = useReducedMotion();
  const listaRef = useRef<HTMLDivElement>(null);
  /** Solo se salta al principio al cambiar de página a mano, no en la primera pintura. */
  const saltar = useRef(false);

  // Cambiar un filtro vuelve a la primera página: quedarse en la quinta de una lista que ahora
  // tiene dos enseña un vacío que parece un fallo. Se hace en cada cambio y no en un efecto:
  // reaccionar después obliga a una segunda pintura con la página mala ya en pantalla.
  const buscar = (v: string) => {
    setTexto(v);
    setPagina(1);
  };
  const cambiarAreas = (v: Skill["area"][]) => {
    setAreas(v);
    setPagina(1);
  };
  const cambiarNiveles = (v: Course["level"][]) => {
    setNiveles(v);
    setPagina(1);
  };
  const cambiarEstado = (v: Estado) => {
    setEstado(v);
    setPagina(1);
  };
  const limpiar = () => {
    setTexto("");
    setAreas([]);
    setNiveles([]);
    setEstado("todos");
    setPagina(1);
  };

  const hechos = useMemo(() => new Set(completed), [completed]);
  const skillsPorSlug = useMemo(() => new Map(skills.map((s) => [s.slug, s])), [skills]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return courses.filter((c) => {
      if (estado === "pendientes" && hechos.has(c.slug)) return false;
      if (estado === "terminados" && !hechos.has(c.slug)) return false;
      if (niveles.length && !niveles.includes(c.level)) return false;
      if (areas.length) {
        const suyas = c.teaches.map((s) => skillsPorSlug.get(s)?.area).filter(Boolean);
        if (!suyas.some((a) => areas.includes(a as Skill["area"]))) return false;
      }
      if (!q) return true;
      // Busca también por lo que enseña: "docker" encuentra el curso aunque no esté en el título.
      const heno = normalizar(
        `${c.title} ${c.summary} ${c.teaches.map((s) => skillsPorSlug.get(s)?.name ?? s).join(" ")}`,
      );
      return heno.includes(q);
    });
  }, [courses, busqueda, areas, niveles, estado, hechos, skillsPorSlug]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + POR_PAGINA);

  useEffect(() => {
    if (!saltar.current) return;
    saltar.current = false;
    listaRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [actual, reduce]);

  const irA = (n: number) => {
    saltar.current = true;
    setPagina(Math.min(Math.max(1, n), paginas));
  };

  const horas = filtrados.reduce((h, c) => h + c.durationHours, 0);
  const alternar = <T,>(lista: T[], valor: T) =>
    lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  const hayFiltros = Boolean(areas.length || niveles.length || estado !== "todos" || texto);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface/30 px-4 py-4">
        <label htmlFor={buscarId} className="sr-only">
          Buscar un curso
        </label>
        <div className="relative">
          <Search
            aria-hidden
            size={17}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted"
          />
          <input
            id={buscarId}
            type="search"
            value={texto}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Busca por nombre, tema o tecnología…"
            className="h-11 w-full rounded-md border border-line-strong bg-surface pr-4 pl-10 placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_auto_auto] sm:gap-x-8">
          <GrupoFiltro titulo="Área">
            {(Object.keys(AREA_LABEL) as Skill["area"][]).map((a) => (
              <Chip key={a} activo={areas.includes(a)} onClick={() => cambiarAreas(alternar(areas, a))}>
                {AREA_LABEL[a]}
              </Chip>
            ))}
          </GrupoFiltro>

          <GrupoFiltro titulo="Nivel">
            {LEVELS.map((n) => (
              <Chip
                key={n}
                activo={niveles.includes(n)}
                onClick={() => cambiarNiveles(alternar(niveles, n))}
              >
                {LEVEL_LABEL[n]}
              </Chip>
            ))}
          </GrupoFiltro>

          <GrupoFiltro titulo="Estado">
            {ESTADOS.map((e) => (
              <Chip key={e.valor} activo={estado === e.valor} onClick={() => cambiarEstado(e.valor)}>
                {e.etiqueta}
              </Chip>
            ))}
          </GrupoFiltro>
        </div>
      </div>

      <div ref={listaRef} className="flex scroll-mt-20 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
          {filtrados.length} de {courses.length} cursos · {hoursLabel(horas)}
          {paginas > 1 && ` · página ${actual} de ${paginas}`}
        </p>
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
          >
            <RotateCcw aria-hidden size={13} strokeWidth={2} />
            Quitar filtros
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface/40 px-5 py-10 text-center text-ink-muted">
          <SearchX aria-hidden size={26} strokeWidth={1.5} />
          Ningún curso encaja con eso. Prueba con menos filtros.
        </p>
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          <AnimatePresence initial={false} mode="popLayout">
            {visibles.map((c, i) => {
              const hecho = hechos.has(c.slug);
              return (
                <motion.li
                  key={c.slug}
                  layout={reduce ? false : "position"}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  // El escalonado se corta pronto: esperar a la última tarjeta sería lento.
                  transition={{
                    duration: 0.22,
                    delay: Math.min(i, 8) * 0.02,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface/40 px-4 py-4 transition-colors duration-150 hover:border-line-strong"
                >
                  <div className="flex items-start gap-2.5">
                    <Star state={hecho ? "completed" : "locked"} size={20} />
                    <h2 className="min-w-0 flex-1 leading-snug font-medium">{c.title}</h2>
                  </div>
                  <p className="text-xs text-ink-muted tabular-nums">
                    {LEVEL_LABEL[c.level]} · {hoursLabel(c.durationHours)}
                    {hecho && " · ya lo terminaste"}
                  </p>
                  <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{c.summary}</p>
                  <p className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {c.teaches.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted"
                      >
                        {skillsPorSlug.get(s)?.name ?? s}
                      </span>
                    ))}
                  </p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
                  >
                    Ver en DevTalles
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                    <ArrowUpRight aria-hidden size={14} strokeWidth={2} />
                  </a>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {paginas > 1 && (
        <nav
          aria-label="Páginas del catálogo"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={() => irA(actual - 1)}
            disabled={actual === 1}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft aria-hidden size={15} strokeWidth={2} />
            Anterior
          </button>

          <ul className="flex flex-wrap items-center gap-1">
            {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => irA(n)}
                  aria-current={n === actual ? "page" : undefined}
                  aria-label={`Página ${n}`}
                  className={
                    "h-9 min-w-9 rounded-md border px-2 text-sm tabular-nums transition-colors duration-150 " +
                    (n === actual
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line text-ink-muted hover:border-line-strong hover:text-ink")
                  }
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => irA(actual + 1)}
            disabled={actual === paginas}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            Siguiente
            <ChevronRight aria-hidden size={15} strokeWidth={2} />
          </button>
        </nav>
      )}
    </div>
  );
}
