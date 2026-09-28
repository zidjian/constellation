import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CatalogBrowser, type Skill } from "@/features/catalog/catalog-browser";
import type { Course } from "@/features/paths/types";
import { serverApiFetch } from "@/lib/api.server";

export const metadata: Metadata = { title: "Catálogo · Constellation" };

export default async function CursosPage() {
  // El catálogo y lo ya terminado se piden en paralelo: son dos lecturas independientes.
  const [catalogo, completados] = await Promise.all([
    serverApiFetch<{ courses: (Course & { teaches: string[] })[]; skills: Skill[] }>(
      "/catalog/courses",
    ),
    serverApiFetch<{ courses: { course: Course }[] }>("/paths/completed"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">El catálogo de DevTalles</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Los {catalogo.courses.length} cursos sobre los que trazamos tus rutas. Explóralos si
            quieres; para saber cuáles son los tuyos y en qué orden, haz la entrevista.
          </p>
        </div>
        {/* Elegir a mano entre 74 cursos es justo el problema que resuelve la entrevista. */}
        <ButtonLink href="/assessment" variant="accent" className="shrink-0">
          <Sparkles aria-hidden size={16} strokeWidth={1.75} />
          Hacer la entrevista
        </ButtonLink>
      </header>
      <CatalogBrowser
        courses={catalogo.courses}
        skills={catalogo.skills}
        completed={completados.courses.map((c) => c.course.slug)}
      />
    </div>
  );
}
