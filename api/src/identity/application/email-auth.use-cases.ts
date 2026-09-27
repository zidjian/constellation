import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import { DomainError } from '../../shared/domain/domain-error';
import {
  MAILER,
  type Mailer,
  PASSWORD_HASHER,
  PASSWORD_RESET_TOKENS,
  type PasswordHasher,
  type PasswordResetTokens,
  SESSION_TOKENS,
  type SessionTokens,
  USER_REPOSITORY,
  type UserRepository,
} from '../domain/ports';
import {
  normalizeEmail,
  passwordProblem,
  type User,
  usernameFromEmail,
} from '../domain/user';

/** Una hora: suficiente para ir al correo, corto para que un enlace filtrado sirva de poco. */
const RESET_TTL_MS = 60 * 60 * 1000;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const invalidCredentials = () =>
  new DomainError(
    'INVALID_CREDENTIALS',
    'Correo o contraseña incorrectos',
    'unauthenticated',
  );

@Injectable()
export class EmailAuthUseCases {
  private readonly logger = new Logger(EmailAuthUseCases.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(PASSWORD_RESET_TOKENS) private readonly resets: PasswordResetTokens,
    @Inject(SESSION_TOKENS) private readonly sessions: SessionTokens,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(input: {
    email: string;
    password: string;
    username?: string;
  }): Promise<{ user: User; sessionToken: string }> {
    const email = normalizeEmail(input.email);
    const problem = passwordProblem(input.password);
    if (problem) throw new DomainError('WEAK_PASSWORD', problem, 'validation');

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.createWithEmail({
      email,
      username: input.username?.trim() || usernameFromEmail(email),
      passwordHash,
    });
    if (!user) {
      throw new DomainError(
        'EMAIL_TAKEN',
        'Ya hay una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
        'conflict',
      );
    }
    this.logger.log(`Alta con correo: ${user.id}`);
    return { user, sessionToken: await this.sessions.issue(user.id) };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: User; sessionToken: string }> {
    const found = await this.users.findByEmail(normalizeEmail(input.email));
    // Se calcula un hash aunque no exista la cuenta: el tiempo de respuesta no revela si hay correo.
    const hash = found?.passwordHash ?? (await this.dummyHash());
    const ok = await this.hasher.verify(input.password, hash);
    if (!found || !found.passwordHash || !ok) throw invalidCredentials();

    // El hash no sale del caso de uso.
    const user: User = {
      id: found.id,
      discordId: found.discordId,
      username: found.username,
      avatarUrl: found.avatarUrl,
      email: found.email,
    };
    return { user, sessionToken: await this.sessions.issue(user.id) };
  }

  /**
   * Siempre responde lo mismo exista o no la cuenta: si no, la respuesta dice quién está registrado.
   * Un fallo al enviar se registra en el log, no se devuelve.
   */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const found = await this.users.findByEmail(email);
    if (!found) return;

    if (!found.passwordHash && found.discordId) {
      // Cuenta creada con Discord: mandarle a "restablecer" no le sirve de nada.
      this.logger.log(
        `Recuperación pedida para una cuenta de Discord: ${found.id}`,
      );
      return;
    }

    await this.resets.invalidateFor(found.id);
    const token = randomBytes(32).toString('base64url');
    await this.resets.issue(
      found.id,
      sha256(token),
      new Date(Date.now() + RESET_TTL_MS),
    );

    const url = `${this.env.WEB_ORIGIN}/restablecer?token=${token}`;
    try {
      await this.mailer.sendPasswordReset(email, url);
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el correo de recuperación a ${found.id}: ${err instanceof Error ? err.message : 'error'}`,
      );
    }
  }

  /** Cambia la contraseña y abre sesión: quien acaba de probar el correo no tiene que entrar otra vez. */
  async resetPassword(input: {
    token: string;
    password: string;
  }): Promise<{ sessionToken: string }> {
    const problem = passwordProblem(input.password);
    if (problem) throw new DomainError('WEAK_PASSWORD', problem, 'validation');

    const userId = await this.resets.consume(sha256(input.token), new Date());
    if (!userId) {
      throw new DomainError(
        'RESET_TOKEN_INVALID',
        'Ese enlace ya no sirve. Pide uno nuevo.',
        'validation',
      );
    }
    await this.users.setPasswordHash(
      userId,
      await this.hasher.hash(input.password),
    );
    this.logger.log(`Contraseña restablecida: ${userId}`);
    return { sessionToken: await this.sessions.issue(userId) };
  }

  /** Hash de descarte con el mismo coste que uno real. */
  private dummyHash(): Promise<string> {
    return this.hasher.hash(randomBytes(16).toString('hex'));
  }
}
