"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SkyMap } from "@/features/constellation/sky-map";
import { ApiError } from "@/lib/api";
import { deletePath, updatePath } from "./api";
import { LightBar, progressLabel } from "./light-bar";
import type { PathSummary } from "./types";

const MAX_PATHS = 10;
const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export function PathList({ initial }: { initial: PathSummary[] }) {
  const [paths, setPaths] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const active = paths.filter((p) => p.status === "active");
  const archived = paths.filter((p) => p.status === "archived");
  const atLimit = paths.length >= MAX_PATHS;

  // La que sigues: la más avanzada sin terminar; si no has empezado ninguna, la más reciente.
  const inProgress = active.filter((p) => p.progress.completed > 0 && p.progress.completed < p.progress.total);
  const featured = inProgress[0] ?? active[0] ?? null;
  const rest = active.filter((p) => p.id !== featured?.id);

  const apply = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio.");
    }
  };
  const actions = {
    rename: (id: string, name: string) =>
      apply(async () => {
        const updated = await updatePath(id, { name });
        setPaths((ps) => ps.map((p) => (p.id === id ? updated : p)));
      }),
    setStatus: (id: string, status: PathSummary["status"]) =>
      apply(async () => {
        const updated = await updatePath(id, { status });
        setPaths((ps) => ps.map((p) => (p.id === id ? updated : p)));
      }),
    remove: (id: string) =>
      apply(async () => {
        await deletePath(id);
        setPaths((ps) => ps.filter((p) => p.id !== id));
      }),
  };

  if (!paths.length) return <EmptySky />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Tu cielo</h1>
          <p className="mt-1 text-sm text-ink-muted tabular-nums">
            {paths.length} de {MAX_PATHS} rutas
          </p>
        </div>
        {atLimit ? (
          <p className="text-sm text-ink-muted">Llegaste al máximo: elimina una para crear otra.</p>
        ) : (
          <ButtonLink href="/assessment" variant="accent">
            Trazar otra ruta
          </ButtonLink>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {featured && <FeaturedPath path={featured} actions={actions} />}

      {rest.length > 0 && (
        <PathGrid title={featured ? "Las demás" : "Activas"} paths={rest} actions={actions} />
      )}
      {archived.length > 0 && <PathGrid title="Archivadas" paths={archived} actions={actions} />}
    </div>
  );
}

function EmptySky() {
  return (
    <section className="flex flex-col items-start gap-6 py-10">
      <SkyMap
        stars={Array.from({ length: 5 }, (_, i) => ({
          slug: `x${i}`,
          title: "",
          position: i,
          state: "locked" as const,
        }))}
        edges={[]}
        label="Constelación de ejemplo, aún sin rutas"
        mini
        className="w-40 opacity-40"
      />
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Tu cielo está vacío</h1>
        <p className="mt-2 max-w-[58ch] leading-relaxed text-ink-muted">
          Una entrevista de 3 minutos basta para trazar la primera: te preguntamos qué quieres lograr, medimos lo que ya
          sabes y ordenamos los cursos de DevTalles para ti.
        </p>
      </div>
      <ButtonLink href="/assessment" size="lg" variant="accent">
        Trazar mi primera ruta
      </ButtonLink>
    </section>
  );
}

type Actions = {
  rename: (id: string, name: string) => Promise<void>;
  setStatus: (id: string, status: PathSummary["status"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const miniStars = (path: PathSummary) =>
  Array.from({ length: path.progress.total }, (_, i) => ({
    slug: `${path.id}-${i}`,
    title: "",
    position: i,
    state: (i < path.progress.completed ? "completed" : "locked") as "completed" | "locked",
  }));

/** La ruta que sigues: primera, a doble tamaño y con la acción de continuar. */
function FeaturedPath({ path, actions }: { path: PathSummary; actions: Actions }) {
  const left = path.progress.total - path.progress.completed;
  return (
    <section aria-labelledby="continuar" className="rounded-xl border border-line bg-surface/50 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <SkyMap
          stars={miniStars(path)}
          edges={[]}
          label={`Constelación de ${path.name}`}
          mini
          className="w-full max-w-[16rem] shrink-0 sm:w-56"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">
            {path.progress.completed > 0 ? "Sigues aquí" : "Empieza aquí"}
          </p>
          <h2 id="continuar" className="text-xl font-semibold sm:text-2xl">
            {path.name}
          </h2>
          <LightBar progress={path.progress} />
          <p className="text-sm text-ink-muted tabular-nums">
            {progressLabel(path.progress)}
            {left > 0 && ` · ${left === 1 ? "queda 1 curso" : `quedan ${left} cursos`}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ButtonLink href={`/paths/${path.id}`} variant="accent">
              {path.progress.completed > 0 ? "Continuar por aquí" : "Abrir la ruta"}
            </ButtonLink>
            <PathMenu path={path} actions={actions} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PathGrid({ title, paths, actions }: { title: string; paths: PathSummary[]; actions: Actions }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-sm font-medium text-ink-muted">
        {title}
      </h2>
      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
        {paths.map((p) => (
          <PathCard key={p.id} path={p} actions={actions} />
        ))}
      </ul>
    </section>
  );
}

function PathCard({ path, actions }: { path: PathSummary; actions: Actions }) {
  return (
    <li className="group relative flex flex-col gap-3 rounded-xl border border-line bg-surface/40 p-4 transition-colors duration-150 ease-out-quint hover:border-line-strong">
      <SkyMap
        stars={miniStars(path)}
        edges={[]}
        label={`Constelación de ${path.name}`}
        mini
        className="w-full opacity-90"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link
          href={`/paths/${path.id}`}
          className="line-clamp-2 font-medium underline-offset-4 outline-offset-4 hover:underline"
        >
          {/* El enlace cubre la tarjeta: el menú de acciones va por encima. */}
          <span className="absolute inset-0 rounded-xl" aria-hidden />
          {path.name}
        </Link>
        <LightBar progress={path.progress} />
        <p className="text-xs text-ink-muted tabular-nums">
          {progressLabel(path.progress)} · {dateFmt.format(new Date(path.createdAt))}
        </p>
      </div>
      <div className="absolute top-2.5 right-2.5">
        <PathMenu path={path} actions={actions} />
      </div>
    </li>
  );
}

/**
 * Acciones secundarias en un menú: renombrar, archivar y eliminar dejan de competir con el nombre
 * de la ruta. `details` nativo, así que funciona con teclado y se cierra con Escape sin código.
 */
function PathMenu({ path, actions }: { path: PathSummary; actions: Actions }) {
  const [mode, setMode] = useState<"menu" | "rename" | "confirm-delete">("menu");
  const [name, setName] = useState(path.name);
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <details
      className="relative z-(--z-dropdown)"
      onToggle={(e) => !(e.currentTarget as HTMLDetailsElement).open && setMode("menu")}
    >
      <summary
        aria-label={`Acciones de ${path.name}`}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor">
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </summary>

      <div className="absolute right-0 z-(--z-dropdown) mt-1 w-64 rounded-lg border border-line bg-surface-2 p-2 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.8)]">
        {mode === "menu" && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setMode("rename")}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface"
            >
              Renombrar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => actions.setStatus(path.id, path.status === "active" ? "archived" : "active"))}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface"
            >
              {path.status === "active" ? "Archivar" : "Reactivar"}
            </button>
            <button
              type="button"
              onClick={() => setMode("confirm-delete")}
              className="rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            >
              Eliminar
            </button>
          </div>
        )}

        {mode === "rename" && (
          <form
            className="flex flex-col gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await actions.rename(path.id, name);
                setMode("menu");
              });
            }}
          >
            <label htmlFor={inputId} className="text-xs text-ink-muted">
              Nuevo nombre
            </label>
            <input
              id={inputId}
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setMode("menu")}
              className="h-9 rounded-md border border-line-strong bg-bg px-3 text-sm focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="accent" loading={busy} disabled={!name.trim()}>
                Guardar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode("menu")}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {mode === "confirm-delete" && (
          <div role="alert" className="flex flex-col gap-2 p-1">
            <p className="text-sm">¿Eliminar “{path.name}” y su progreso?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => actions.remove(path.id))} autoFocus>
                Sí, eliminar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("menu")}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
