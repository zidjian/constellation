import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import {
  EMAIL_CHANGE_TOKENS,
  type EmailChangeTokens,
  MAILER,
  type Mailer,
  PASSWORD_HASHER,
  PASSWORD_RESET_TOKENS,
  type PasswordHasher,
  type PasswordResetTokens,
  USER_REPOSITORY,
  type UserRepository,
} from '../domain/ports';
import { normalizeEmail, passwordProblem, type User } from '../domain/user';

const CONFIRM_TTL_MS = 60 * 60 * 1000;
const USERNAME_MAX = 100;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const wrongPassword = () =>
  new DomainError(
    'INVALID_CREDENTIALS',
    'La contraseña actual no es correcta',
    'unauthenticated',
  );

/**
 * Edición del perfil. Dos reglas transversales:
 *  - cualquier cambio sensible (contraseña, correo, borrado) pide la contraseña actual si la cuenta
 *    tiene una, para que una sesión robada no se quede con la cuenta;
 *  - el correo nuevo no entra en `users` hasta que se confirma **desde ese correo**.
 */
@Injectable()
export class ProfileUseCases {
  private readonly logger = new Logger(ProfileUseCases.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EMAIL_CHANGE_TOKENS) private readonly changes: EmailChangeTokens,
    @Inject(PASSWORD_RESET_TOKENS) private readonly resets: PasswordResetTokens,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async rename(userId: string, rawName: string): Promise<User> {
    const username = rawName.trim();
    if (username.length < 2 || username.length > USERNAME_MAX) {
      throw new DomainError(
        'INVALID_USERNAME',
        `El nombre necesita entre 2 y ${USERNAME_MAX} caracteres`,
        'validation',
      );
    }
    await this.users.setUsername(userId, username);
    return this.mustFind(userId);
  }

  /**
   * Cambia la contraseña. Si la cuenta ya tenía una, exige la actual. Una cuenta de Discord que
   * acaba de confirmar su correo puede poner la primera sin nada más.
   */
  async changePassword(
    userId: string,
    input: { currentPassword?: string; newPassword: string },
  ): Promise<void> {
    const problem = passwordProblem(input.newPassword);
    if (problem) throw new DomainError('WEAK_PASSWORD', problem, 'validation');

    const user = await this.mustFind(userId);
    const current = await this.passwordHashOf(user);

    if (current) {
      const ok =
        !!input.currentPassword &&
        (await this.hasher.verify(input.currentPassword, current));
      if (!ok) throw wrongPassword();
    } else if (!user.email) {
      throw new DomainError(
        'EMAIL_REQUIRED',
        'Añade y confirma un correo antes de poner una contraseña',
        'conflict',
      );
    }

    await this.users.setPasswordHash(
      userId,
      await this.hasher.hash(input.newPassword),
    );
    // Un enlace de recuperación pendiente deja de valer: la contraseña ya cambió.
    await this.resets.invalidateFor(userId);
    this.logger.log(`Contraseña cambiada desde el perfil: ${userId}`);
  }

  /** Manda el enlace al correo nuevo. Hasta confirmarlo, la cuenta sigue con el anterior. */
  async requestEmailChange(
    userId: string,
    input: { email: string; password?: string },
  ): Promise<{ pendingEmail: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.mustFind(userId);
    const current = await this.passwordHashOf(user);

    if (current) {
      const ok =
        !!input.password && (await this.hasher.verify(input.password, current));
      if (!ok) throw wrongPassword();
    }
    if (user.email === email) {
      throw new DomainError(
        'EMAIL_UNCHANGED',
        'Ese ya es tu correo actual',
        'validation',
      );
    }
    // Se comprueba aquí para avisar pronto; la palabra final la tiene el índice único al confirmar.
    if (await this.users.findByEmail(email)) {
      throw new DomainError(
        'EMAIL_TAKEN',
        'Ese correo ya está en otra cuenta',
        'conflict',
      );
    }

    await this.changes.invalidateFor(userId);
    const token = randomBytes(32).toString('base64url');
    await this.changes.issue(
      userId,
      email,
      sha256(token),
      new Date(Date.now() + CONFIRM_TTL_MS),
    );

    const url = `${this.env.WEB_ORIGIN}/perfil/confirmar-correo?token=${token}`;
    try {
      await this.mailer.sendEmailChange(email, url);
    } catch (err) {
      this.logger.error(
        `No se pudo enviar la confirmación de correo de ${userId}: ${err instanceof Error ? err.message : 'error'}`,
      );
      throw new DomainError(
        'MAIL_NOT_SENT',
        'No pudimos enviar el correo de confirmación. Inténtalo de nuevo en un momento.',
        'conflict',
      );
    }
    return { pendingEmail: email };
  }

  async confirmEmailChange(token: string): Promise<User> {
    const pending = await this.changes.consume(sha256(token), new Date());
    if (!pending) {
      throw new DomainError(
        'EMAIL_TOKEN_INVALID',
        'Ese enlace ya no sirve. Pide otro desde tu perfil.',
        'validation',
      );
    }
    const user = await this.users.setEmail(pending.userId, pending.newEmail);
    if (!user) {
      throw new DomainError(
        'EMAIL_TAKEN',
        'Ese correo ya está en otra cuenta',
        'conflict',
      );
    }
    this.logger.log(`Correo confirmado: ${user.id}`);
    return user;
  }

  /**
   * Borra la cuenta y todo lo suyo (las rutas, el progreso y las entrevistas caen por cascada).
   * Con contraseña hay que darla; sin ella (cuenta de Discord) hay que escribir la palabra exacta.
   */
  async deleteAccount(
    userId: string,
    input: { password?: string; confirm?: string },
  ): Promise<void> {
    const user = await this.mustFind(userId);
    const current = await this.passwordHashOf(user);

    if (current) {
      const ok =
        !!input.password && (await this.hasher.verify(input.password, current));
      if (!ok) throw wrongPassword();
    } else if (input.confirm?.trim().toUpperCase() !== 'ELIMINAR') {
      throw new DomainError(
        'CONFIRMATION_REQUIRED',
        'Escribe ELIMINAR para confirmar que quieres borrar tu cuenta',
        'validation',
      );
    }

    await this.users.remove(userId);
    this.logger.log(`Cuenta eliminada: ${userId}`);
  }

  private async mustFind(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Sesión no válida',
        'unauthenticated',
      );
    return user;
  }

  /** El hash solo se lee por correo, así que una cuenta sin correo no tiene contraseña. */
  private async passwordHashOf(user: User): Promise<string | null> {
    if (!user.email) return null;
    const found = await this.users.findByEmail(user.email);
    return found?.passwordHash ?? null;
  }
}
