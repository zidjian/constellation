import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SessionRequest } from '../../identity/presentation/current-user.decorator';

/** Límites por usuario y hora. Los nombres se referencian con @Throttle en cada ruta. */
export const RATE_LIMITS = {
  generate: { name: 'generate', limit: 5, ttl: 60 * 60 * 1000 },
  complete: { name: 'complete', limit: 20, ttl: 60 * 60 * 1000 },
} as const;

/** Rate limit por usuario (no por IP): corre después del guard global de sesión. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      `user:${(req as unknown as SessionRequest).userId ?? 'anon'}`,
    );
  }
}
