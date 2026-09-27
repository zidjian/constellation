import { DomainError } from '../../shared/domain/domain-error';
import type { Env } from '../../shared/infrastructure/config/env';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import type {
  Mailer,
  PasswordResetTokens,
  SessionTokens,
  UserRepository,
} from '../domain/ports';
import type { DiscordProfile, EmailAccount, User } from '../domain/user';
import { EmailAuthUseCases } from './email-auth.use-cases';

class InMemoryUsers implements UserRepository {
  readonly rows = new Map<string, User & { passwordHash: string | null }>();

  upsertByDiscordId(p: DiscordProfile): Promise<User> {
    const user = {
      id: `u${this.rows.size + 1}`,
      ...p,
      email: null,
      passwordHash: null,
    };
    this.rows.set(user.id, user);
    return Promise.resolve(user);
  }
  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findByEmail(email: string) {
    return Promise.resolve(
      [...this.rows.values()].find((u) => u.email === email) ?? null,
    );
  }
  createWithEmail(account: EmailAccount): Promise<User | null> {
    if ([...this.rows.values()].some((u) => u.email === account.email))
      return Promise.resolve(null);
    const user = {
      id: `u${this.rows.size + 1}`,
      discordId: null,
      avatarUrl: null,
      ...account,
    };
    this.rows.set(user.id, user);
    return Promise.resolve(user);
  }
  setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const row = this.rows.get(userId);
    if (row) row.passwordHash = passwordHash;
    return Promise.resolve();
  }
}

class InMemoryResets implements PasswordResetTokens {
  readonly rows: {
    userId: string;
    hash: string;
    expiresAt: Date;
    used: boolean;
  }[] = [];
  issue(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.rows.push({ userId, hash: tokenHash, expiresAt, used: false });
    return Promise.resolve();
  }
  consume(tokenHash: string, now: Date): Promise<string | null> {
    const row = this.rows.find(
      (r) => r.hash === tokenHash && !r.used && r.expiresAt > now,
    );
    if (!row) return Promise.resolve(null);
    row.used = true;
    return Promise.resolve(row.userId);
  }
  invalidateFor(userId: string): Promise<void> {
    for (const r of this.rows) if (r.userId === userId) r.used = true;
    return Promise.resolve();
  }
}

const tokens: SessionTokens = {
  issue: (userId) => Promise.resolve(`token-${userId}`),
  verify: () => Promise.resolve(null),
};

const env = { WEB_ORIGIN: 'https://app.test' } as Env;

function build(mailer?: Mailer) {
  const users = new InMemoryUsers();
  const resets = new InMemoryResets();
  const enviados: { to: string; url: string }[] = [];
  const auth = new EmailAuthUseCases(
    users,
    new ScryptPasswordHasher(),
    resets,
    tokens,
    mailer ?? {
      sendPasswordReset: (to, url) => {
        enviados.push({ to, url });
        return Promise.resolve();
      },
    },
    env,
  );
  const tokenDe = (url: string) => new URL(url).searchParams.get('token')!;
  return { auth, users, resets, enviados, tokenDe };
}

const clave = 'constelacion2026';

describe('Alta con correo', () => {
  it('normaliza el correo y deduce el nombre visible', async () => {
    const { auth, users } = build();
    const { user } = await auth.register({
      email: '  Ada@Example.COM ',
      password: clave,
    });
    expect(user.email).toBe('ada@example.com');
    expect(user.username).toBe('ada');
    expect(users.rows.get(user.id)!.passwordHash).not.toContain(clave);
  });

  it('no guarda la contraseña en claro', async () => {
    const { auth, users } = build();
    const { user } = await auth.register({ email: 'a@b.com', password: clave });
    const hash = users.rows.get(user.id)!.passwordHash!;
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain(clave);
  });

  it('rechaza contraseñas cortas o sin números', async () => {
    const { auth } = build();
    await expect(
      auth.register({ email: 'a@b.com', password: 'corta1' }),
    ).rejects.toThrow(DomainError);
    await expect(
      auth.register({ email: 'a@b.com', password: 'sololetrasaqui' }),
    ).rejects.toThrow(/letras y números/);
  });

  it('un correo repetido no crea una segunda cuenta', async () => {
    const { auth } = build();
    await auth.register({ email: 'a@b.com', password: clave });
    await expect(
      auth.register({ email: 'A@B.com', password: clave }),
    ).rejects.toThrow(/Ya hay una cuenta/);
  });
});

describe('Login con correo', () => {
  it('entra con la contraseña correcta', async () => {
    const { auth } = build();
    const { user } = await auth.register({ email: 'a@b.com', password: clave });
    await expect(
      auth.login({ email: 'A@B.COM', password: clave }),
    ).resolves.toMatchObject({
      user: { id: user.id, email: 'a@b.com' },
      sessionToken: `token-${user.id}`,
    });
  });

  it('mismo error para contraseña mala que para cuenta inexistente', async () => {
    const { auth } = build();
    await auth.register({ email: 'a@b.com', password: clave });
    const mala = await auth
      .login({ email: 'a@b.com', password: 'otraclave2026' })
      .catch((e: DomainError) => e);
    const noExiste = await auth
      .login({ email: 'nadie@b.com', password: clave })
      .catch((e: DomainError) => e);
    expect((mala as DomainError).code).toBe('INVALID_CREDENTIALS');
    expect((noExiste as DomainError).code).toBe('INVALID_CREDENTIALS');
  });

  it('una cuenta de Discord sin contraseña no entra por aquí', async () => {
    const { auth, users } = build();
    const user = await users.upsertByDiscordId({
      discordId: '42',
      username: 'ada',
      avatarUrl: null,
    });
    users.rows.get(user.id)!.email = 'ada@discord.test';
    await expect(
      auth.login({ email: 'ada@discord.test', password: clave }),
    ).rejects.toThrow(/incorrectos/);
  });
});

describe('Recuperar contraseña', () => {
  it('manda un enlace con un token que no se guarda en claro', async () => {
    const { auth, resets, enviados, tokenDe } = build();
    await auth.register({ email: 'a@b.com', password: clave });
    await auth.requestPasswordReset('A@b.com');

    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toBe('a@b.com');
    const token = tokenDe(enviados[0].url);
    expect(resets.rows[0].hash).not.toBe(token);
  });

  it('no manda nada ni falla si el correo no tiene cuenta', async () => {
    const { auth, enviados } = build();
    await expect(
      auth.requestPasswordReset('nadie@b.com'),
    ).resolves.toBeUndefined();
    expect(enviados).toHaveLength(0);
  });

  it('un fallo del correo no rompe la petición', async () => {
    const { auth } = build({
      sendPasswordReset: () =>
        Promise.reject(new Error('Resend respondió 500')),
    });
    await auth.register({ email: 'a@b.com', password: clave });
    await expect(auth.requestPasswordReset('a@b.com')).resolves.toBeUndefined();
  });

  it('el enlace cambia la contraseña, abre sesión y solo sirve una vez', async () => {
    const { auth, enviados, tokenDe } = build();
    const { user } = await auth.register({ email: 'a@b.com', password: clave });
    await auth.requestPasswordReset('a@b.com');
    const token = tokenDe(enviados[0].url);

    await expect(
      auth.resetPassword({ token, password: 'nuevaclave2026' }),
    ).resolves.toEqual({
      sessionToken: `token-${user.id}`,
    });
    await expect(
      auth.login({ email: 'a@b.com', password: 'nuevaclave2026' }),
    ).resolves.toBeDefined();
    await expect(
      auth.login({ email: 'a@b.com', password: clave }),
    ).rejects.toThrow();
    await expect(
      auth.resetPassword({ token, password: 'otraclave2026' }),
    ).rejects.toThrow(/ya no sirve/);
  });

  it('pedir otro enlace invalida el anterior', async () => {
    const { auth, enviados, tokenDe } = build();
    await auth.register({ email: 'a@b.com', password: clave });
    await auth.requestPasswordReset('a@b.com');
    await auth.requestPasswordReset('a@b.com');

    const viejo = tokenDe(enviados[0].url);
    const nuevo = tokenDe(enviados[1].url);
    await expect(
      auth.resetPassword({ token: viejo, password: 'nuevaclave2026' }),
    ).rejects.toThrow();
    await expect(
      auth.resetPassword({ token: nuevo, password: 'nuevaclave2026' }),
    ).resolves.toBeDefined();
  });

  it('un token caducado no sirve', async () => {
    const { auth, resets, enviados, tokenDe } = build();
    await auth.register({ email: 'a@b.com', password: clave });
    await auth.requestPasswordReset('a@b.com');
    resets.rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(
      auth.resetPassword({
        token: tokenDe(enviados[0].url),
        password: 'nuevaclave2026',
      }),
    ).rejects.toThrow(/ya no sirve/);
  });
});

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([hasher.hash(clave), hasher.hash(clave)]);
    expect(a).not.toBe(b);
    await expect(hasher.verify(clave, a)).resolves.toBe(true);
    await expect(hasher.verify(clave, b)).resolves.toBe(true);
  });

  it('devuelve false ante una contraseña distinta o un hash ilegible', async () => {
    const hash = await hasher.hash(clave);
    await expect(hasher.verify('otra2026clave', hash)).resolves.toBe(false);
    await expect(hasher.verify(clave, 'cualquier-cosa')).resolves.toBe(false);
    await expect(hasher.verify(clave, 'scrypt$1$1$1$$')).resolves.toBe(false);
  });
});
