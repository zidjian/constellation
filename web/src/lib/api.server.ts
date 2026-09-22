import "server-only";
import { cookies } from "next/headers";
import { apiUrl, parseApiResponse } from "./api";

export const SESSION_COOKIE = "cst_session";

// Desde Server Components: reenvía la cookie de sesión del usuario a la API.
export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = (await cookies()).get(SESSION_COOKIE);
  const res = await fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Cookie: `${SESSION_COOKIE}=${session.value}` } : {}),
      ...init.headers,
    },
  });
  return parseApiResponse<T>(res);
}
