// Del perfil de Discord guardamos solo esto (invariante: nunca tokens).
export interface User {
  id: string;
  discordId: string | null;
  username: string;
  avatarUrl: string | null;
  /** Solo en cuentas con correo y contraseña. */
  email: string | null;
}

export interface DiscordProfile {
  discordId: string;
  username: string;
  avatarUrl: string | null;
}

/** Cuenta con correo: lo que hace falta para crearla. */
export interface EmailAccount {
  email: string;
  username: string;
  passwordHash: string;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Reglas de la contraseña. Cortas de verdad no, pero tampoco reglas de composición imposibles:
 * la longitud es lo que protege (NIST SP 800-63B).
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `La contraseña necesita al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX)
    return `La contraseña no puede pasar de ${PASSWORD_MAX} caracteres`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
    return 'Mezcla letras y números para que no sea adivinable';
  return null;
}

/** Nombre visible por defecto cuando alguien se registra con correo. */
export const usernameFromEmail = (email: string) =>
  normalizeEmail(email).split('@')[0].slice(0, 100) || 'Estudiante';
