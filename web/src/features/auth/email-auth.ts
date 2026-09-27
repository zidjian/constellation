import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "./types";

type SessionUser = Pick<CurrentUser, "id" | "username"> & { email: string | null };

export const register = (body: { email: string; password: string; username?: string }) =>
  apiFetch<{ user: SessionUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) });

export const login = (body: { email: string; password: string }) =>
  apiFetch<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) });

export const forgotPassword = (email: string) =>
  apiFetch<{ sent: true; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (body: { token: string; password: string }) =>
  apiFetch<{ reset: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) });

/** Mismo mínimo que el dominio de la API: los mensajes exactos los manda ella. */
export const PASSWORD_MIN = 10;
