import Link from "next/link";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { apiUrl } from "@/lib/api";

// Landing provisional (F1): el diseño final llega en F4 con impeccable.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const user = await getCurrentUser().catch(() => null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">DevTalles Constellation</h1>
      <p className="text-lg">
        Rutas de aprendizaje a tu medida sobre el catálogo real de DevTalles.
      </p>
      {error === "auth" && (
        <p role="alert" className="text-sm text-red-500">
          No se pudo iniciar sesión con Discord. Inténtalo de nuevo.
        </p>
      )}
      {user ? (
        <Link
          href="/paths"
          className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background"
        >
          Ir a mis rutas
        </Link>
      ) : (
        // Navegación completa (no fetch): el OAuth lo resuelve la API con redirecciones.
        <a
          href={apiUrl("/auth/discord")}
          className="self-start rounded-md bg-[#5865F2] px-4 py-2 font-medium text-white"
        >
          Entrar con Discord
        </a>
      )}
    </main>
  );
}
