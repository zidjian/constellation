import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../shared/infrastructure/config/config.module';
import type { Env } from '../shared/infrastructure/config/env';
import { CompleteDiscordLoginUseCase } from './application/complete-discord-login.use-case';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case';
import { DISCORD_OAUTH, SESSION_TOKENS, USER_REPOSITORY } from './domain/ports';
import { DiscordOAuthClient } from './infrastructure/discord-oauth.client';
import {
  JwtSessionTokens,
  SESSION_TTL_SECONDS,
} from './infrastructure/jwt-session-tokens';
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
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: DISCORD_OAUTH, useClass: DiscordOAuthClient },
    { provide: SESSION_TOKENS, useClass: JwtSessionTokens },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [SESSION_TOKENS],
})
export class IdentityModule {}
