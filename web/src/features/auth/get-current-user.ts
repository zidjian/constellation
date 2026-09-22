import "server-only";
import { ApiError } from "@/lib/api";
import { serverApiFetch } from "@/lib/api.server";
import type { CurrentUser } from "./types";

/** Usuario de la sesión o null si no hay sesión válida. Otros errores se propagan. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await serverApiFetch<CurrentUser>("/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
