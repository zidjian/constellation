import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../shared/infrastructure/config/config.module';
import type { Env } from '../shared/infrastructure/config/env';
import { CompleteDiscordLoginUseCase } from './application/complete-discord-login.use-case';
import { EmailAuthUseCases } from './application/email-auth.use-cases';
import { ProfileUseCases } from './application/profile.use-cases';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case';
import {
  DISCORD_OAUTH,
  EMAIL_CHANGE_TOKENS,
  MAILER,
  PASSWORD_HASHER,
  PASSWORD_RESET_TOKENS,
  SESSION_TOKENS,
  USER_REPOSITORY,
} from './domain/ports';
import { DiscordOAuthClient } from './infrastructure/discord-oauth.client';
import {
  JwtSessionTokens,
  SESSION_TTL_SECONDS,
} from './infrastructure/jwt-session-tokens';
import { ResendMailer } from './infrastructure/resend-mailer';
import { TypeOrmEmailChangeTokens } from './infrastructure/typeorm-email-change-tokens';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher';
import { TypeOrmPasswordResetTokens } from './infrastructure/typeorm-password-reset-tokens';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { AuthController } from './presentation/auth.controller';
import { MeController } from './presentation/me.controller';
import { SessionGuard } from './presentation/session.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: SESSION_TTL_SECONDS, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    CompleteDiscordLoginUseCase,
    GetCurrentUserUseCase,
    EmailAuthUseCases,
    ProfileUseCases,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: DISCORD_OAUTH, useClass: DiscordOAuthClient },
    { provide: SESSION_TOKENS, useClass: JwtSessionTokens },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: PASSWORD_RESET_TOKENS, useClass: TypeOrmPasswordResetTokens },
    { provide: EMAIL_CHANGE_TOKENS, useClass: TypeOrmEmailChangeTokens },
    { provide: MAILER, useClass: ResendMailer },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [SESSION_TOKENS],
})
export class IdentityModule {}
