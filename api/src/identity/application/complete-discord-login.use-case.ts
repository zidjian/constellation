import { Inject, Injectable } from '@nestjs/common';
import {
  DISCORD_OAUTH,
  type DiscordOAuth,
  SESSION_TOKENS,
  type SessionTokens,
  USER_REPOSITORY,
  type UserRepository,
} from '../domain/ports';

@Injectable()
export class CompleteDiscordLoginUseCase {
  constructor(
    @Inject(DISCORD_OAUTH) private readonly discord: DiscordOAuth,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_TOKENS) private readonly tokens: SessionTokens,
  ) {}

  async execute(code: string): Promise<{ sessionToken: string }> {
    const profile = await this.discord.fetchProfile(code);
    const user = await this.users.upsertByDiscordId(profile);
    return { sessionToken: await this.tokens.issue(user.id) };
  }
}
