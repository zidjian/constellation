import { ButtonLink } from "@/components/ui/button";

export default function PathNotFound() {
  return (
    <section className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-2xl font-semibold">No encontramos esa ruta</h1>
      <p className="text-ink-muted">Puede que la hayas eliminado o que el enlace no sea tuyo.</p>
      <ButtonLink href="/paths">Ver mis rutas</ButtonLink>
    </section>
  );
}
