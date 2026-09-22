import type { Metadata } from "next";
import { PathList } from "@/features/paths/path-list";
import type { PathSummary } from "@/features/paths/types";
import { serverApiFetch } from "@/lib/api.server";

export const metadata: Metadata = { title: "Mis rutas · Constellation" };

export default async function PathsPage() {
  const paths = await serverApiFetch<PathSummary[]>("/paths");
  return <PathList initial={paths} />;
}
