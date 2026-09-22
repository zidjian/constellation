import { Controller, Get } from '@nestjs/common';
import { GetCurrentUserUseCase } from '../application/get-current-user.use-case';
import { CurrentUserId } from './current-user.decorator';

@Controller('me')
export class MeController {
  constructor(private readonly getCurrentUser: GetCurrentUserUseCase) {}

  @Get()
  async me(@CurrentUserId() userId: string) {
    const { id, discordId, username, avatarUrl } =
      await this.getCurrentUser.execute(userId);
    return { id, discordId, username, avatarUrl };
  }
}
