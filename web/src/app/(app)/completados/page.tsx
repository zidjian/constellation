import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarCheck, Clock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Star } from "@/components/ui/star";
import { Reveal } from "@/components/ui/reveal";
import { hoursLabel } from "@/features/paths/light-bar";
import type { Course } from "@/features/paths/types";
import { serverApiFetch } from "@/lib/api.server";

export const metadata: Metadata = { title: "Cursos terminados · Constellation" };

interface Completado {
  course: Course;
  completedAt: string;
  paths: { id: string; name: string }[];
}

const fecha = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });

export default async function CompletadosPage() {
  const { courses, totalHours } = await serverApiFetch<{
    courses: Completado[];
    totalHours: number;
  }>("/paths/completed");

  if (!courses.length) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-5 py-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">Aún no encendiste ninguna estrella</h1>
        <p className="leading-relaxed text-ink-muted">
          Cuando marques un curso como completado en cualquiera de tus rutas, aparecerá aquí con la
          fecha y las horas que llevas invertidas.
        </p>
        <ButtonLink href="/paths" variant="accent">
          Ir a mis rutas
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Cursos que ya terminaste</h1>
        <p className="mt-1 text-sm text-ink-muted tabular-nums">
          {courses.length} {courses.length === 1 ? "curso" : "cursos"} · {hoursLabel(totalHours)}{" "}
          invertidas
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {courses.map(({ course, completedAt, paths }, i) => (
          <Reveal key={course.slug} as="li" index={i} className="flex items-start gap-3.5 rounded-xl border border-line bg-surface/40 px-4 py-4">
            <Star state="completed" size={26} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{course.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarCheck aria-hidden size={14} strokeWidth={1.75} />
                  {fecha.format(new Date(completedAt))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden size={14} strokeWidth={1.75} />
                  {hoursLabel(course.durationHours)}
                </span>
              </p>
              <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-muted">
                <span>En</span>
                {paths.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/paths/${p.id}`}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {p.name}
                    {i < paths.length - 1 ? "," : ""}
                  </Link>
                ))}
              </p>
            </div>
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
            >
              Abrir
              <span className="sr-only"> {course.title} en DevTalles (se abre en otra pestaña)</span>
              <ArrowUpRight aria-hidden size={14} strokeWidth={2} />
            </a>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
