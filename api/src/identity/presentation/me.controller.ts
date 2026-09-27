import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
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
import type { Response } from 'express';
import {
  RATE_LIMITS,
  UserThrottlerGuard,
} from '../../shared/presentation/user-throttler.guard';
import { GetCurrentUserUseCase } from '../application/get-current-user.use-case';
import { ProfileUseCases } from '../application/profile.use-cases';
import { PASSWORD_MAX, PASSWORD_MIN, type User } from '../domain/user';
import { CurrentUserId } from './current-user.decorator';
import { Public } from './public.decorator';
import { clearSessionCookie } from './session-cookie';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import { Inject } from '@nestjs/common';

class RenameDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  username!: string;
}

class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  currentPassword?: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}

class ChangeEmailDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password?: string;
}

class ConfirmEmailDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}

class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  confirm?: string;
}

/** La cuenta tal como la ve la web: nunca sale el hash. */
const toView = (u: User) => ({
  id: u.id,
  discordId: u.discordId,
  username: u.username,
  avatarUrl: u.avatarUrl,
  email: u.email,
});

@Controller('me')
export class MeController {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly profile: ProfileUseCases,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  async me(@CurrentUserId() userId: string) {
    return toView(await this.getCurrentUser.execute(userId));
  }

  @Patch()
  async rename(@CurrentUserId() userId: string, @Body() dto: RenameDto) {
    return toView(await this.profile.rename(userId, dto.username));
  }

  @Post('password')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.changePassword })
  @HttpCode(200)
  async changePassword(
    @CurrentUserId() userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.profile.changePassword(userId, dto);
    return { changed: true };
  }

  /** Manda el enlace al correo nuevo; la cuenta no cambia hasta confirmarlo. */
  @Post('email')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.changeEmail })
  @HttpCode(202)
  async changeEmail(
    @CurrentUserId() userId: string,
    @Body() dto: ChangeEmailDto,
  ) {
    const { pendingEmail } = await this.profile.requestEmailChange(userId, dto);
    return {
      pendingEmail,
      message: `Te escribimos a ${pendingEmail}. Confírmalo desde ahí y tu cuenta pasa a ese correo.`,
    };
  }

  /**
   * Público a propósito: el enlace llega al correo nuevo y puede abrirse en otro navegador,
   * donde no hay sesión. El token es la prueba, no la cookie.
   */
  @Public()
  @Post('email/confirm')
  @HttpCode(200)
  async confirmEmail(@Body() dto: ConfirmEmailDto) {
    return toView(await this.profile.confirmEmailChange(dto.token));
  }

  @Delete()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.deleteAccount })
  @HttpCode(200)
  async remove(
    @CurrentUserId() userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.profile.deleteAccount(userId, dto);
    clearSessionCookie(res, this.env);
    return { deleted: true };
  }
}
