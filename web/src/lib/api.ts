// Cliente de la API. Formato único: éxito { data }, error { error: { code, message } }.
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!configuredApiUrl && process.env.NODE_ENV === "production") {
  // Se incrusta en build time: un build de producción sin ella apuntaría a localhost sin avisar.
  throw new Error("Falta NEXT_PUBLIC_API_URL en el build de producción");
}
export const API_URL = configuredApiUrl ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Envelope<T> = { data: T } | { error: { code: string; message: string } };

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (body && "data" in body && res.ok) return body.data;
  if (body && "error" in body) throw new ApiError(res.status, body.error.code, body.error.message);
  throw new ApiError(res.status, "UNEXPECTED_RESPONSE", `Respuesta inesperada (HTTP ${res.status})`);
}

export function apiUrl(path: string): string {
  return `${API_URL}/v1${path}`;
}

// Content-Type solo si hay body: en un GET forzaría un preflight CORS innecesario.
export function withJsonHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

// Desde el navegador: la cookie de sesión viaja sola gracias a credentials: 'include'.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: withJsonHeaders(init),
  });
  return parseApiResponse<T>(res);
}
