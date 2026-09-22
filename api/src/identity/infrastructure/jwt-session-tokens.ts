import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SessionTokens } from '../domain/ports';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class JwtSessionTokens implements SessionTokens {
  constructor(private readonly jwt: JwtService) {}

  issue(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }

  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
