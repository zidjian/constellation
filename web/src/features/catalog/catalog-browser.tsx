"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, RotateCcw, Search, SearchX } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
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
  const [estado, setEstado] = useState<"todos" | "pendientes" | "terminados">("todos");
  const busqueda = useDeferredValue(texto);
  const reduce = useReducedMotion();

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

  const horas = filtrados.reduce((h, c) => h + c.durationHours, 0);
  const alternar = <T,>(lista: T[], valor: T) =>
    lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
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
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Busca por nombre, tema o tecnología…"
            className="h-11 w-full rounded-md border border-line-strong bg-surface pr-4 pl-10 placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(AREA_LABEL) as Skill["area"][]).map((a) => (
            <Chip key={a} activo={areas.includes(a)} onClick={() => setAreas(alternar(areas, a))}>
              {AREA_LABEL[a]}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((n) => (
            <Chip key={n} activo={niveles.includes(n)} onClick={() => setNiveles(alternar(niveles, n))}>
              {LEVEL_LABEL[n]}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          {(["todos", "pendientes", "terminados"] as const).map((e) => (
            <Chip key={e} activo={estado === e} onClick={() => setEstado(e)}>
              {e === "todos" ? "Todos" : e === "pendientes" ? "Me faltan" : "Terminados"}
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
        {filtrados.length} de {courses.length} cursos · {hoursLabel(horas)}
        {(areas.length || niveles.length || estado !== "todos" || texto) && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setAreas([]);
              setNiveles([]);
              setEstado("todos");
            }}
            className="ml-3 inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
          >
            <RotateCcw aria-hidden size={13} strokeWidth={2} />
            Quitar filtros
          </button>
        )}
      </p>

      {filtrados.length === 0 ? (
        <p className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface/40 px-5 py-10 text-center text-ink-muted">
          <SearchX aria-hidden size={26} strokeWidth={1.5} />
          Ningún curso encaja con eso. Prueba con menos filtros.
        </p>
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          <AnimatePresence initial={false} mode="popLayout">
          {filtrados.map((c, i) => {
            const hecho = hechos.has(c.slug);
            return (
              <motion.li
                key={c.slug}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                // El escalonado se corta pronto: con 74 cursos, esperar a la última tarjeta sería lento.
                transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.02, ease: [0.22, 1, 0.36, 1] }}
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
                    <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
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
    </div>
  );
}
