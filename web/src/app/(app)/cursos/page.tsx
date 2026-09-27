import type { Metadata } from "next";
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
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">El catálogo de DevTalles</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Los {catalogo.courses.length} cursos sobre los que trazamos tus rutas. Filtra y marca lo que
          ya llevas.
        </p>
      </header>
      <CatalogBrowser
        courses={catalogo.courses}
        skills={catalogo.skills}
        completed={completados.courses.map((c) => c.course.slug)}
      />
    </div>
  );
}
