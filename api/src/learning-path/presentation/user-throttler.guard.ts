import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SessionRequest } from '../../identity/presentation/current-user.decorator';

/** Rate limit por usuario (no por IP): corre después del guard global de sesión. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      `user:${(req as unknown as SessionRequest).userId ?? 'anon'}`,
    );
  }
}
