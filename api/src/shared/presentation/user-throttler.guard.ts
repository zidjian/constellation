import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SessionRequest } from '../../identity/presentation/current-user.decorator';

const HOUR = 60 * 60 * 1000;

/**
 * Límites por usuario y hora. Cada ruta sobrescribe el throttler `default` con el suyo
 * (@Throttle({ default: ... })): la clave del contador incluye la ruta, así que no se pisan.
 * Registrar varios throttlers con nombre no serviría: el guard los evalúa TODOS en cada ruta,
 * y el más estricto acababa limitando a las demás.
 */
export const RATE_LIMITS = {
  generate: { limit: 5, ttl: HOUR },
  complete: { limit: 20, ttl: HOUR },
  // Simulacro: cada turno es una llamada al LLM, así que se acota por los dos lados.
  recruiterStart: { limit: 3, ttl: HOUR },
  recruiterReply: { limit: 60, ttl: HOUR },
} as const;

/** Solo por si una ruta usa el guard sin @Throttle: nunca debería ser el límite efectivo. */
export const DEFAULT_RATE_LIMIT = { name: 'default', limit: 60, ttl: HOUR };

/** Rate limit por usuario (no por IP): corre después del guard global de sesión. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      `user:${(req as unknown as SessionRequest).userId ?? 'anon'}`,
    );
  }
}
