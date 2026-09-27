import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import {
  RATE_LIMITS,
  IpThrottlerGuard,
} from '../../shared/presentation/user-throttler.guard';
import { CompleteDiscordLoginUseCase } from '../application/complete-discord-login.use-case';
import { EmailAuthUseCases } from '../application/email-auth.use-cases';
import { PASSWORD_MAX, PASSWORD_MIN } from '../domain/user';
import { DISCORD_OAUTH, type DiscordOAuth } from '../domain/ports';
import { Public } from './public.decorator';
import {
  clearSessionCookie,
  clearStateCookie,
  OAUTH_STATE_COOKIE,
  setSessionCookie,
  setStateCookie,
} from './session-cookie';

class RegisterDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(320)
  email!: string;

  // El detalle de la contraseña lo valida el dominio (passwordProblem), con su mensaje.
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

class ForgotPasswordDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(320)
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DISCORD_OAUTH) private readonly discord: DiscordOAuth,
    private readonly completeLogin: CompleteDiscordLoginUseCase,
    private readonly emailAuth: EmailAuthUseCases,
  ) {}

  /** Alta con correo y contraseña. Deja la sesión abierta, como el login con Discord. */
  @Public()
  @Post('register')
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.register })
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, sessionToken } = await this.emailAuth.register(dto);
    setSessionCookie(res, this.env, sessionToken);
    return {
      user: { id: user.id, username: user.username, email: user.email },
    };
  }

  @Public()
  @Post('login')
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.login })
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, sessionToken } = await this.emailAuth.login(dto);
    setSessionCookie(res, this.env, sessionToken);
    return {
      user: { id: user.id, username: user.username, email: user.email },
    };
  }

  /**
   * Manda el enlace de recuperación. Responde siempre lo mismo, exista o no la cuenta: si no,
   * este endpoint se convierte en un comprobador de correos registrados.
   */
  @Public()
  @Post('forgot-password')
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.forgotPassword })
  @HttpCode(202)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.emailAuth.requestPasswordReset(dto.email);
    return {
      sent: true,
      message:
        'Si ese correo tiene cuenta, le llegará un enlace en unos minutos.',
    };
  }

  @Public()
  @Post('reset-password')
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.resetPassword })
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionToken } = await this.emailAuth.resetPassword(dto);
    setSessionCookie(res, this.env, sessionToken);
    return { reset: true };
  }

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
