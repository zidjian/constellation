import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../../shared/domain/domain-error';
import {
  SESSION_TOKENS,
  type SessionTokens,
  USER_REPOSITORY,
  type UserRepository,
} from '../domain/ports';
import type { SessionRequest } from './current-user.decorator';
import { IS_PUBLIC } from './public.decorator';
import { SESSION_COOKIE } from './session-cookie';

// Guard global (APP_GUARD): toda ruta exige sesión salvo las marcadas con @Public().
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_TOKENS) private readonly tokens: SessionTokens,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    const userId = token ? await this.tokens.verify(token) : null;
    // Un JWT válido de un usuario borrado no es una sesión: evita FKs rotas en los casos de uso.
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Inicia sesión para continuar',
        'unauthenticated',
      );
    }
    req.userId = user.id;
    return true;
  }
}
