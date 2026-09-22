// Cliente de la API. Formato único: éxito { data }, error { error: { code, message } }.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

// Desde el navegador: la cookie de sesión viaja sola gracias a credentials: 'include'.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  return parseApiResponse<T>(res);
}
