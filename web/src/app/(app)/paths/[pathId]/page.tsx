import Link from "next/link";
import { notFound } from "next/navigation";
import { PathView } from "@/features/paths/path-view";
import type { PathDetail } from "@/features/paths/types";
import { ApiError } from "@/lib/api";
import { serverApiFetch } from "@/lib/api.server";

export default async function PathPage({ params }: PageProps<"/paths/[pathId]">) {
  const { pathId } = await params;
  let path: PathDetail;
  try {
    path = await serverApiFetch<PathDetail>(`/paths/${encodeURIComponent(pathId)}`);
  } catch (err) {
    // 404 (inexistente o de otro usuario) y 400 (id inválido) se ven igual: no existe.
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return (
    <div className="flex flex-col gap-6">
      <Link href="/paths" className="self-start text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        ← Mis rutas
      </Link>
      <PathView initial={path} />
    </div>
  );
}
