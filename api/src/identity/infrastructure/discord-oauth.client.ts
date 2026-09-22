import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import type { DiscordOAuth } from '../domain/ports';
import type { DiscordProfile } from '../domain/user';

const DISCORD = 'https://discord.com';

// OAuth2 de Discord a mano (sin passport-discord): el state vive en una cookie, sin express-session.
@Injectable()
export class DiscordOAuthClient implements DiscordOAuth {
  private readonly logger = new Logger(DiscordOAuthClient.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.DISCORD_CLIENT_ID,
      redirect_uri: this.env.DISCORD_CALLBACK_URL,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'none',
    });
    return `${DISCORD}/oauth2/authorize?${params}`;
  }

  async fetchProfile(code: string): Promise<DiscordProfile> {
    const tokenRes = await fetch(`${DISCORD}/api/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.DISCORD_CLIENT_ID,
        client_secret: this.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.env.DISCORD_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) {
      // No se loguea el cuerpo: podría contener datos del intercambio.
      this.logger.warn(
        `Discord rechazó el intercambio de code (HTTP ${tokenRes.status})`,
      );
      throw oauthFailed();
    }
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token?: string;
    };
    if (!accessToken) throw oauthFailed();

    const meRes = await fetch(`${DISCORD}/api/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!meRes.ok) throw oauthFailed();
    const me = (await meRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    // El access token se descarta aquí: no se persiste ni sale de este método.
    return {
      discordId: me.id,
      username: me.global_name || me.username,
      avatarUrl: me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
        : null,
    };
  }
}

function oauthFailed(): DomainError {
  return new DomainError(
    'DISCORD_OAUTH_FAILED',
    'No se pudo completar el login con Discord',
    'unauthenticated',
  );
}
