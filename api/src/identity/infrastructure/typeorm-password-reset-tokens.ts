import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PasswordResetTokens } from '../domain/ports';

@Injectable()
export class TypeOrmPasswordResetTokens implements PasswordResetTokens {
  constructor(private readonly dataSource: DataSource) {}

  async issue(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  /**
   * Marcar y leer en una sola sentencia: dos usos simultáneos del mismo enlace no pasan los dos.
   * Va envuelto en un CTE porque `query()` devuelve `[filas, contador]` en un UPDATE con RETURNING,
   * y `filas[0]` sería el array entero (mismo tropiezo que el seed del catálogo).
   */
  async consume(tokenHash: string, now: Date): Promise<string | null> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `WITH consumido AS (
         UPDATE password_reset_tokens SET used_at = $2
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
         RETURNING user_id
       )
       SELECT user_id FROM consumido`,
      [tokenHash, now],
    );
    return rows[0]?.user_id ?? null;
  }

  async invalidateFor(userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
  }
}
