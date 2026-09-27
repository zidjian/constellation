export interface CurrentUser {
  id: string;
  /** null en las cuentas creadas con correo. */
  discordId: string | null;
  username: string;
  avatarUrl: string | null;
  email: string | null;
}
