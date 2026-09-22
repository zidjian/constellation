import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type SessionRequest = Request & { userId?: string };

/** userId de la sesión, puesto por SessionGuard. */
export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (!req.userId) throw new Error('CurrentUserId usado en una ruta pública');
    return req.userId;
  },
);
