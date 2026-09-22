import type { Logger } from '@nestjs/common';

export type LlmSource = 'claude' | 'rules';

/**
 * Ejecuta el adaptador de IA con un tope de tiempo y, ante cualquier fallo (red, timeout, rechazo,
 * salida inválida), usa las reglas. Nunca rechaza: la demo no depende de una API externa (ADR-0001).
 */
export async function withFallback<T>(
  label: string,
  timeoutMs: number,
  primary: (signal: AbortSignal) => Promise<T>,
  fallback: () => Promise<T>,
  logger: Logger,
): Promise<{ value: T; by: LlmSource }> {
  const signal = AbortSignal.timeout(timeoutMs);
  const started = Date.now();
  try {
    const value = await primary(signal);
    logger.log(`${label}: claude en ${Date.now() - started} ms`);
    return { value, by: 'claude' };
  } catch (err) {
    const reason = signal.aborted
      ? `timeout de ${timeoutMs} ms`
      : err instanceof Error
        ? err.message
        : 'error';
    // Solo el motivo: nunca el cuerpo de la petición ni la clave.
    logger.warn(`${label}: fallback a reglas (${reason})`);
    return { value: await fallback(), by: 'rules' };
  }
}
