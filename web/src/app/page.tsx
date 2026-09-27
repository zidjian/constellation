import { BrandMark } from "@/components/brand-mark";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { SkyMap } from "@/features/constellation/sky-map";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { HeroConstellation } from "@/features/landing/hero-constellation";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    // La misma constelación en tres momentos: lo cuenta la propia pieza, no tres tarjetas iguales.
    lit: 0,
    title: "Una entrevista de 3 minutos",
    text: "Nos cuentas qué quieres lograr, o pegas una oferta de trabajo, y resuelves unos mini-retos de código. Así sabemos de dónde partes de verdad.",
  },
  {
    lit: 0,
    drawn: true,
    title: "Tu constelación, en vivo",
    text: "Trazamos el orden exacto de cursos del catálogo de DevTalles, respetando qué va antes de qué. Cada estrella te dice por qué está ahí.",
  },
  {
    lit: 2,
    drawn: true,
    title: "Enciende cada estrella",
    text: "Marca los cursos que completas y mira cómo se ilumina el camino. Puedes tener varias rutas y volver cuando quieras.",
  },
];

function DiscordIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.6ZM8.3 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const user = await getCurrentUser().catch(() => null);

  const cta = user ? (
    <ButtonLink href="/paths" size="lg" variant="accent">
      Ir a mis rutas
    </ButtonLink>
  ) : (
    // Navegación completa (no fetch): el OAuth lo resuelve la API con redirecciones.
    <a href={apiUrl("/auth/discord")} className={buttonClass("accent", "lg")}>
      <DiscordIcon />
      Entrar con Discord
    </a>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <BrandMark />
        {user ? (
          <ButtonLink href="/paths" variant="secondary" size="sm">
            Mis rutas
          </ButtonLink>
        ) : (
          <a href={apiUrl("/auth/discord")} className={buttonClass("secondary", "sm")}>
            Entrar
          </a>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="grid items-center gap-10 pt-8 pb-16 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pb-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="text-[2.5rem] leading-[1.05] font-semibold sm:text-[3.25rem]">
              Tu camino por DevTalles, <span className="text-primary-strong">estrella a estrella</span>.
            </h1>
            <p className="max-w-[34rem] text-lg leading-relaxed text-ink-muted">
              Para la comunidad DevTalles. Más de 70 cursos y no sabes por cuál empezar. Cuéntanos a dónde quieres llegar, resuelve unos mini-retos y
              te trazamos la ruta exacta, en el orden que tiene sentido.
            </p>
            {error === "auth" && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                No se pudo iniciar sesión con Discord. Inténtalo de nuevo.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {cta}
              <span className="text-sm text-ink-muted">Gratis · sin formularios largos</span>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <HeroConstellation />
          </div>
        </section>

        <section aria-labelledby="how" className="border-t border-line py-14 sm:py-20">
          <h2 id="how" className="text-2xl font-semibold sm:text-3xl">
            Cómo funciona
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-4">
                <div className="rounded-xl border border-line bg-surface/40 px-5 py-6">
                  <SkyMap
                    stars={Array.from({ length: 4 }, (_, j) => ({
                      slug: `${i}-${j}`,
                      title: "",
                      position: j,
                      state: j < s.lit ? ("completed" as const) : ("locked" as const),
                    }))}
                    edges={[
                      { from: `${i}-0`, to: `${i}-1` },
                      { from: `${i}-1`, to: `${i}-2` },
                    ]}
                    lines={Boolean(s.drawn)}
                    label={`Paso ${i + 1}: ${s.title}`}
                    mini
                    className={s.drawn ? "w-full" : "w-full opacity-60"}
                  />
                </div>
                <div>
                  <h3 className="font-semibold">
                    <span className="text-ink-muted tabular-nums">{i + 1}. </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-ink-muted">
          <span>Hecho para Code Quest 2026 · Cursos reales de DevTalles</span>
          <a
            href="https://github.com/zidjian/constellation"
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            Código abierto (MIT)
          </a>
        </div>
      </footer>
    </div>
  );
}
