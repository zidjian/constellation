import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import { CompleteDiscordLoginUseCase } from '../application/complete-discord-login.use-case';
import { DISCORD_OAUTH, type DiscordOAuth } from '../domain/ports';
import { Public } from './public.decorator';
import {
  clearSessionCookie,
  clearStateCookie,
  OAUTH_STATE_COOKIE,
  setSessionCookie,
  setStateCookie,
} from './session-cookie';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DISCORD_OAUTH) private readonly discord: DiscordOAuth,
    private readonly completeLogin: CompleteDiscordLoginUseCase,
  ) {}

  @Public()
  @Get('discord')
  start(@Res() res: Response): void {
    const state = randomBytes(24).toString('base64url');
    setStateCookie(res, this.env, state);
    res.redirect(302, this.discord.authorizeUrl(state));
  }

  @Public()
  @Get('discord/callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = cookies[OAUTH_STATE_COOKIE];
    clearStateCookie(res, this.env);

    if (!code || !state || !expected || !sameState(state, expected)) {
      // Incluye el caso "el usuario canceló en Discord" (llega error=access_denied sin code).
      return res.redirect(302, `${this.env.WEB_ORIGIN}/?error=auth`);
    }
    try {
      const { sessionToken } = await this.completeLogin.execute(code);
      setSessionCookie(res, this.env, sessionToken);
      // Sin rutas todavía (learning-path llega en F3): /paths muestra el estado vacío que lleva a /assessment.
      res.redirect(302, `${this.env.WEB_ORIGIN}/paths`);
    } catch (err) {
      this.logger.warn(
        `Login con Discord fallido: ${err instanceof Error ? err.message : 'error'}`,
      );
      res.redirect(302, `${this.env.WEB_ORIGIN}/?error=auth`);
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res, this.env);
    return { loggedOut: true };
  }
}

function sameState(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
