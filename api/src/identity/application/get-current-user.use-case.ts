import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { USER_REPOSITORY, type UserRepository } from '../domain/ports';
import type { User } from '../domain/user';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    // Un token válido de un usuario borrado equivale a no tener sesión.
    if (!user)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Sesión no válida',
        'unauthenticated',
      );
    return user;
  }
}
