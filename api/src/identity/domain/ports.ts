import type { DiscordProfile, User } from './user';

export const USER_REPOSITORY = Symbol('UserRepository');
export interface UserRepository {
  upsertByDiscordId(profile: DiscordProfile): Promise<User>;
  findById(id: string): Promise<User | null>;
}

export const DISCORD_OAUTH = Symbol('DiscordOAuth');
export interface DiscordOAuth {
  authorizeUrl(state: string): string;
  /** Intercambia el code por un token, lee el perfil y descarta el token. */
  fetchProfile(code: string): Promise<DiscordProfile>;
}

export const SESSION_TOKENS = Symbol('SessionTokens');
export interface SessionTokens {
  issue(userId: string): Promise<string>;
  /** Devuelve el userId o null si el token no es válido o expiró. */
  verify(token: string): Promise<string | null>;
}
