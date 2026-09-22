import type { CookieOptions, Response } from 'express';
import type { Env } from '../../shared/infrastructure/config/env';
import { SESSION_TTL_SECONDS } from '../infrastructure/jwt-session-tokens';

export const SESSION_COOKIE = 'cst_session';
export const OAUTH_STATE_COOKIE = 'cst_oauth_state';

// Domain=.constellation.waldirmaidana.com en producción: si fuera host-only de backend., Next nunca la vería.
function base(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
  };
}

export function setSessionCookie(res: Response, env: Env, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    ...base(env),
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response, env: Env): void {
  res.clearCookie(SESSION_COOKIE, { ...base(env), path: '/' });
}

// El state anti-CSRF solo viaja al callback y vive 10 minutos. Host-only: no hace falta en la web.
const STATE_PATH = '/v1/auth/discord';
export function setStateCookie(res: Response, env: Env, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...base(env),
    domain: undefined,
    path: STATE_PATH,
    maxAge: 10 * 60 * 1000,
  });
}

export function clearStateCookie(res: Response, env: Env): void {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    ...base(env),
    domain: undefined,
    path: STATE_PATH,
  });
}
