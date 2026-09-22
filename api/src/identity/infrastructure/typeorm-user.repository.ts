import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UserRepository } from '../domain/ports';
import type { DiscordProfile, User } from '../domain/user';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UserRow = {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
};
const toUser = (r: UserRow): User => ({
  id: r.id,
  discordId: r.discord_id,
  username: r.username,
  avatarUrl: r.avatar_url,
});

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async upsertByDiscordId(p: DiscordProfile): Promise<User> {
    const [row] = await this.dataSource.query<UserRow[]>(
      `INSERT INTO users (discord_id, username, avatar_url) VALUES ($1, $2, $3)
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url, updated_at = now()
       RETURNING id, discord_id, username, avatar_url`,
      [p.discordId, p.username, p.avatarUrl],
    );
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID.test(id)) return null;
    const [row] = await this.dataSource.query<UserRow[]>(
      `SELECT id, discord_id, username, avatar_url FROM users WHERE id = $1`,
      [id],
    );
    return row ? toUser(row) : null;
  }
}
