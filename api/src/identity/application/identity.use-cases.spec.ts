import { DomainError } from '../../shared/domain/domain-error';
import type {
  DiscordOAuth,
  SessionTokens,
  UserRepository,
} from '../domain/ports';
import type { DiscordProfile, User } from '../domain/user';
import { CompleteDiscordLoginUseCase } from './complete-discord-login.use-case';
import { GetCurrentUserUseCase } from './get-current-user.use-case';

class InMemoryUsers implements UserRepository {
  readonly rows = new Map<string, User>();
  upsertByDiscordId(p: DiscordProfile): Promise<User> {
    const existing = [...this.rows.values()].find(
      (u) => u.discordId === p.discordId,
    );
    const user = { id: existing?.id ?? `u${this.rows.size + 1}`, ...p };
    this.rows.set(user.id, user);
    return Promise.resolve(user);
  }
  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
}

const tokens: SessionTokens = {
  issue: (userId) => Promise.resolve(`token-${userId}`),
  verify: () => Promise.resolve(null),
};

const discordReturning = (profile: DiscordProfile): DiscordOAuth => ({
  authorizeUrl: () => '',
  fetchProfile: () => Promise.resolve(profile),
});

describe('CompleteDiscordLoginUseCase', () => {
  it('crea el usuario y emite una sesión propia (no el token de Discord)', async () => {
    const users = new InMemoryUsers();
    const login = new CompleteDiscordLoginUseCase(
      discordReturning({ discordId: '42', username: 'ada', avatarUrl: null }),
      users,
      tokens,
    );
    await expect(login.execute('code')).resolves.toEqual({
      sessionToken: 'token-u1',
    });
    expect([...users.rows.values()]).toEqual([
      { id: 'u1', discordId: '42', username: 'ada', avatarUrl: null },
    ]);
  });

  it('reutiliza el mismo usuario en logins sucesivos y actualiza el perfil', async () => {
    const users = new InMemoryUsers();
    await new CompleteDiscordLoginUseCase(
      discordReturning({ discordId: '42', username: 'ada', avatarUrl: null }),
      users,
      tokens,
    ).execute('c1');
    await new CompleteDiscordLoginUseCase(
      discordReturning({
        discordId: '42',
        username: 'ada-lovelace',
        avatarUrl: 'https://a',
      }),
      users,
      tokens,
    ).execute('c2');
    expect(users.rows.size).toBe(1);
    expect(users.rows.get('u1')?.username).toBe('ada-lovelace');
  });
});

describe('GetCurrentUserUseCase', () => {
  it('trata un usuario inexistente como sesión no válida', async () => {
    const promise = new GetCurrentUserUseCase(new InMemoryUsers()).execute(
      'nadie',
    );
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    await expect(promise).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
