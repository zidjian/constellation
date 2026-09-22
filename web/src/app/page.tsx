import { StreamProbe } from "@/features/health/stream-probe";
import { ApiError } from "@/lib/api";
import { serverApiFetch } from "@/lib/api.server";

// Página provisional (F0): verifica la conexión web → API. La landing real llega en F1.
export const dynamic = "force-dynamic";

async function getHealth(): Promise<string> {
  try {
    const health = await serverApiFetch<{ status: string; database: string }>("/health");
    return `API ${health.status} · base de datos ${health.database}`;
  } catch (err) {
    return err instanceof ApiError ? `API con error: ${err.code}` : "API no disponible";
  }
}

export default async function Home() {
  const health = await getHealth();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">DevTalles Constellation</h1>
      <p>{health}</p>
      <StreamProbe />
    </main>
  );
}
