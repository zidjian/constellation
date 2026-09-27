import type { DiscordProfile, EmailAccount, User } from './user';

export const USER_REPOSITORY = Symbol('UserRepository');
export interface UserRepository {
  upsertByDiscordId(profile: DiscordProfile): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(
    email: string,
  ): Promise<(User & { passwordHash: string | null }) | null>;
  /** Null si el correo ya está tomado (lo decide el índice único, no una consulta previa). */
  createWithEmail(account: EmailAccount): Promise<User | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
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

export const PASSWORD_HASHER = Symbol('PasswordHasher');
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Comparación en tiempo constante; false ante cualquier hash ilegible. */
  verify(password: string, hash: string): Promise<boolean>;
}

/** Token de recuperación: en la base solo vive su hash. */
export const PASSWORD_RESET_TOKENS = Symbol('PasswordResetTokens');
export interface PasswordResetTokens {
  issue(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Marca el token como usado y devuelve su userId. Null si no existe, expiró o ya se usó. */
  consume(tokenHash: string, now: Date): Promise<string | null>;
  /** Invalida los pendientes: pedir otro enlace deja sin efecto el anterior. */
  invalidateFor(userId: string): Promise<void>;
}

export const MAILER = Symbol('Mailer');
export interface Mailer {
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
}
