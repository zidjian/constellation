"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { deletePath, updatePath } from "./api";
import { progressLabel, StarRow } from "./star-row";
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

  if (!paths.length) {
    return (
      <section className="flex flex-col items-start gap-5 py-6">
        <h1 className="text-3xl font-semibold">Tus rutas</h1>
        <p className="max-w-[58ch] text-lg leading-relaxed text-ink-muted">
          Aún no tienes ninguna. Una entrevista de 3 minutos basta para trazar la primera: te preguntamos qué quieres lograr,
          medimos lo que ya sabes y ordenamos los cursos de DevTalles para ti.
        </p>
        <ButtonLink href="/assessment" size="lg">
          Trazar mi primera ruta
        </ButtonLink>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tus rutas</h1>
          <p className="mt-1 text-ink-muted">
            {paths.length} de {MAX_PATHS} rutas
          </p>
        </div>
        {atLimit ? (
          <p className="text-sm text-ink-muted">Llegaste al máximo: elimina una para crear otra.</p>
        ) : (
          <ButtonLink href="/assessment">Nueva ruta</ButtonLink>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <PathGroup title="Activas" paths={active} actions={actions} emptyText="No tienes rutas activas." />
      {archived.length > 0 && <PathGroup title="Archivadas" paths={archived} actions={actions} />}
    </div>
  );
}

type Actions = {
  rename: (id: string, name: string) => Promise<void>;
  setStatus: (id: string, status: PathSummary["status"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function PathGroup({ title, paths, actions, emptyText }: { title: string; paths: PathSummary[]; actions: Actions; emptyText?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-sm font-medium text-ink-muted">
        {title}
      </h2>
      {paths.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {paths.map((p) => (
            <PathRow key={p.id} path={p} actions={actions} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{emptyText}</p>
      )}
    </section>
  );
}

function PathRow({ path, actions }: { path: PathSummary; actions: Actions }) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [name, setName] = useState(path.name);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {mode === "rename" ? (
        <form
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await actions.rename(path.id, name);
              setMode("view");
            });
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Nuevo nombre
          </label>
          <input
            id={inputId}
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setMode("view")}
            className="h-10 flex-1 rounded-md border border-line-strong px-3 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>
              Guardar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Link href={`/paths/${path.id}`} className="group flex min-w-0 flex-1 flex-col gap-1.5 rounded-md">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold underline-offset-4 group-hover:underline">{path.name}</span>
            <span className="text-xs text-ink-muted">{dateFmt.format(new Date(path.createdAt))}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2.5 text-sm text-ink-muted">
            <StarRow progress={path.progress} size={13} />
            <span>{progressLabel(path.progress)}</span>
          </span>
        </Link>
      )}

      {mode === "view" && (
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setMode("rename")}>
            Renombrar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busy}
            onClick={() => run(() => actions.setStatus(path.id, path.status === "active" ? "archived" : "active"))}
          >
            {path.status === "active" ? "Archivar" : "Reactivar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("confirm-delete")}>
            Eliminar
          </Button>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <span>¿Eliminar “{path.name}” y su progreso?</span>
          <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => actions.remove(path.id))} autoFocus>
            Sí, eliminar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancelar
          </Button>
        </div>
      )}
    </li>
  );
}
