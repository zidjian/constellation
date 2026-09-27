import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UserRepository } from '../domain/ports';
import type { DiscordProfile, EmailAccount, User } from '../domain/user';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

type UserRow = {
  id: string;
  discord_id: string | null;
  username: string;
  avatar_url: string | null;
  email: string | null;
};
const toUser = (r: UserRow): User => ({
  id: r.id,
  discordId: r.discord_id,
  username: r.username,
  avatarUrl: r.avatar_url,
  email: r.email,
});

const COLUMNS = `id, discord_id, username, avatar_url, email`;

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async upsertByDiscordId(p: DiscordProfile): Promise<User> {
    const [row] = await this.dataSource.query<UserRow[]>(
      `INSERT INTO users (discord_id, username, avatar_url) VALUES ($1, $2, $3)
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url, updated_at = now()
       RETURNING ${COLUMNS}`,
      [p.discordId, p.username, p.avatarUrl],
    );
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID.test(id)) return null;
    const [row] = await this.dataSource.query<UserRow[]>(
      `SELECT ${COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    return row ? toUser(row) : null;
  }

  async findByEmail(
    email: string,
  ): Promise<(User & { passwordHash: string | null }) | null> {
    const [row] = await this.dataSource.query<
      (UserRow & { password_hash: string | null })[]
    >(`SELECT ${COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
    return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
  }

  /** El correo repetido lo decide el índice único, no un SELECT previo (sin carrera). */
  async createWithEmail(account: EmailAccount): Promise<User | null> {
    try {
      const [row] = await this.dataSource.query<UserRow[]>(
        `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)
         RETURNING ${COLUMNS}`,
        [account.email, account.username, account.passwordHash],
      );
      return toUser(row);
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) return null;
      throw err;
    }
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [userId, passwordHash],
    );
  }
}
