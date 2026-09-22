import Link from "next/link";

// Provisional (F1): el cielo de rutas llega en F4.
export default function PathsPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tus rutas</h1>
      <p>Aún no tienes rutas. Empieza con una entrevista corta para trazar la primera.</p>
      <Link
        href="/assessment"
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Empezar entrevista
      </Link>
    </section>
  );
}
