import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EmailChangeTokens } from '../domain/ports';

@Injectable()
export class TypeOrmEmailChangeTokens implements EmailChangeTokens {
  constructor(private readonly dataSource: DataSource) {}

  async issue(
    userId: string,
    newEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, newEmail, tokenHash, expiresAt],
    );
  }

  /** CTE: `query()` devuelve [filas, contador] en un UPDATE con RETURNING. */
  async consume(
    tokenHash: string,
    now: Date,
  ): Promise<{ userId: string; newEmail: string } | null> {
    const rows = await this.dataSource.query<
      { user_id: string; new_email: string }[]
    >(
      `WITH consumido AS (
         UPDATE email_change_tokens SET used_at = $2
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
         RETURNING user_id, new_email
       )
       SELECT user_id, new_email FROM consumido`,
      [tokenHash, now],
    );
    const row = rows[0];
    return row ? { userId: row.user_id, newEmail: row.new_email } : null;
  }

  async invalidateFor(userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE email_change_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
  }
}
