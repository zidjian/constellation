import "server-only";
import { cookies } from "next/headers";
import { API_URL, parseApiResponse, withJsonHeaders } from "./api";

export const SESSION_COOKIE = "cst_session";

// En el servidor se llama a la API por la red local (PM2 en la misma instancia): sin DNS, sin TLS
// y sin salir a internet. Se lee en runtime; en local cae a la URL pública.
const INTERNAL_API_URL = process.env.API_INTERNAL_URL ?? API_URL;

// Desde Server Components: reenvía la cookie de sesión del usuario a la API.
export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = (await cookies()).get(SESSION_COOKIE);
  const headers = withJsonHeaders(init);
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session.value}`);
  const res = await fetch(`${INTERNAL_API_URL}/v1${path}`, { ...init, cache: "no-store", headers });
  return parseApiResponse<T>(res);
}
