import { apiFetch } from "@/lib/api";
import type { PathSummary, Progress } from "./types";

export const setStepCompletion = (pathId: string, stepId: string, completed: boolean) =>
  apiFetch<{ step: { id: string; completedAt: string | null }; progress: Progress }>(
    `/paths/${pathId}/steps/${stepId}/completion`,
    { method: completed ? "PUT" : "DELETE" },
  );

export const updatePath = (id: string, changes: { name?: string; status?: PathSummary["status"] }) =>
  apiFetch<PathSummary>(`/paths/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deletePath = (id: string) => apiFetch<{ deleted: true }>(`/paths/${id}`, { method: "DELETE" });
