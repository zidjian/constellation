import type { Env } from '../../shared/infrastructure/config/env';
import type {
  EmailChangeTokens,
  Mailer,
  PasswordResetTokens,
  UserRepository,
} from '../domain/ports';
import type { DiscordProfile, EmailAccount, User } from '../domain/user';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import { ProfileUseCases } from './profile.use-cases';

type Row = User & { passwordHash: string | null };

class InMemoryUsers implements UserRepository {
  readonly rows = new Map<string, Row>();

  upsertByDiscordId(p: DiscordProfile): Promise<User> {
    const user: Row = {
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
  findByEmail(email: string): Promise<Row | null> {
    return Promise.resolve(
      [...this.rows.values()].find((u) => u.email === email) ?? null,
    );
  }
  createWithEmail(account: EmailAccount): Promise<User | null> {
    if ([...this.rows.values()].some((u) => u.email === account.email))
      return Promise.resolve(null);
    const user: Row = {
      id: `u${this.rows.size + 1}`,
      discordId: null,
      avatarUrl: null,
      ...account,
    };
    this.rows.set(user.id, user);
    return Promise.resolve(user);
  }
  setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    this.rows.get(userId)!.passwordHash = passwordHash;
    return Promise.resolve();
  }
  setUsername(userId: string, username: string): Promise<void> {
    this.rows.get(userId)!.username = username;
    return Promise.resolve();
  }
  setEmail(userId: string, email: string): Promise<User | null> {
    if (
      [...this.rows.values()].some((u) => u.id !== userId && u.email === email)
    )
      return Promise.resolve(null);
    const row = this.rows.get(userId)!;
    row.email = email;
    return Promise.resolve(row);
  }
  remove(userId: string): Promise<void> {
    this.rows.delete(userId);
    return Promise.resolve();
  }
}

class InMemoryChanges implements EmailChangeTokens {
  readonly rows: {
    userId: string;
    newEmail: string;
    hash: string;
    expiresAt: Date;
    used: boolean;
  }[] = [];
  issue(
    userId: string,
    newEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    this.rows.push({
      userId,
      newEmail,
      hash: tokenHash,
      expiresAt,
      used: false,
    });
    return Promise.resolve();
  }
  consume(
    tokenHash: string,
    now: Date,
  ): Promise<{ userId: string; newEmail: string } | null> {
    const row = this.rows.find(
      (r) => r.hash === tokenHash && !r.used && r.expiresAt > now,
    );
    if (!row) return Promise.resolve(null);
    row.used = true;
    return Promise.resolve({ userId: row.userId, newEmail: row.newEmail });
  }
  invalidateFor(userId: string): Promise<void> {
    for (const r of this.rows) if (r.userId === userId) r.used = true;
    return Promise.resolve();
  }
}

const clave = 'constelacion2026';
const nueva = 'otraclave2026';

function build(mailerFalla = false) {
  const users = new InMemoryUsers();
  const changes = new InMemoryChanges();
  const enviados: { to: string; url: string }[] = [];
  const resetsInvalidados: string[] = [];
  const resets: PasswordResetTokens = {
    issue: () => Promise.resolve(),
    consume: () => Promise.resolve(null),
    invalidateFor: (userId) => {
      resetsInvalidados.push(userId);
      return Promise.resolve();
    },
  };
  const mailer: Mailer = {
    sendPasswordReset: () => Promise.resolve(),
    sendEmailChange: (to, url) => {
      if (mailerFalla) return Promise.reject(new Error('Resend respondió 500'));
      enviados.push({ to, url });
      return Promise.resolve();
    },
  };
  const profile = new ProfileUseCases(
    users,
    new ScryptPasswordHasher(),
    changes,
    resets,
    mailer,
    { WEB_ORIGIN: 'https://app.test' } as Env,
  );
  const tokenDe = (url: string) => new URL(url).searchParams.get('token')!;
  return { profile, users, changes, enviados, resetsInvalidados, tokenDe };
}

/** Cuenta con correo y contraseña ya creada. */
async function conCorreo(t: ReturnType<typeof build>) {
  const hasher = new ScryptPasswordHasher();
  const user = await t.users.createWithEmail({
    email: 'ada@example.com',
    username: 'ada',
    passwordHash: await hasher.hash(clave),
  });
  return user!;
}

describe('Nombre', () => {
  it('lo cambia y recorta los espacios', async () => {
    const t = build();
    const user = await conCorreo(t);
    const out = await t.profile.rename(user.id, '  Ada Lovelace  ');
    expect(out.username).toBe('Ada Lovelace');
  });

  it('rechaza un nombre de una letra', async () => {
    const t = build();
    const user = await conCorreo(t);
    await expect(t.profile.rename(user.id, 'a')).rejects.toThrow(
      /entre 2 y 100/,
    );
  });
});

describe('Cambiar contraseña', () => {
  it('exige la actual y luego entra con la nueva', async () => {
    const t = build();
    const user = await conCorreo(t);
    await expect(
      t.profile.changePassword(user.id, {
        currentPassword: 'equivocada1',
        newPassword: nueva,
      }),
    ).rejects.toThrow(/contraseña actual/);

    await t.profile.changePassword(user.id, {
      currentPassword: clave,
      newPassword: nueva,
    });
    const hasher = new ScryptPasswordHasher();
    const hash = t.users.rows.get(user.id)!.passwordHash!;
    await expect(hasher.verify(nueva, hash)).resolves.toBe(true);
  });

  it('invalida los enlaces de recuperación pendientes', async () => {
    const t = build();
    const user = await conCorreo(t);
    await t.profile.changePassword(user.id, {
      currentPassword: clave,
      newPassword: nueva,
    });
    expect(t.resetsInvalidados).toEqual([user.id]);
  });

  it('rechaza una contraseña nueva floja', async () => {
    const t = build();
    const user = await conCorreo(t);
    await expect(
      t.profile.changePassword(user.id, {
        currentPassword: clave,
        newPassword: 'holahola',
      }),
    ).rejects.toThrow(/caracteres/);
  });

  it('una cuenta de Discord sin correo tiene que añadirlo primero', async () => {
    const t = build();
    const user = await t.users.upsertByDiscordId({
      discordId: '42',
      username: 'ada',
      avatarUrl: null,
    });
    await expect(
      t.profile.changePassword(user.id, { newPassword: clave }),
    ).rejects.toThrow(/Añade y confirma un correo/);
  });
});

describe('Cambiar correo', () => {
  it('no cambia nada hasta confirmar desde el correo nuevo', async () => {
    const t = build();
    const user = await conCorreo(t);
    await t.profile.requestEmailChange(user.id, {
      email: 'NUEVA@example.com',
      password: clave,
    });

    expect(t.enviados[0].to).toBe('nueva@example.com');
    expect(t.users.rows.get(user.id)!.email).toBe('ada@example.com');

    const confirmado = await t.profile.confirmEmailChange(
      t.tokenDe(t.enviados[0].url),
    );
    expect(confirmado.email).toBe('nueva@example.com');
  });

  it('pide la contraseña actual si la cuenta tiene una', async () => {
    const t = build();
    const user = await conCorreo(t);
    await expect(
      t.profile.requestEmailChange(user.id, { email: 'otra@example.com' }),
    ).rejects.toThrow(/contraseña actual/);
  });

  it('una cuenta de Discord añade correo sin contraseña', async () => {
    const t = build();
    const user = await t.users.upsertByDiscordId({
      discordId: '42',
      username: 'ada',
      avatarUrl: null,
    });
    await t.profile.requestEmailChange(user.id, { email: 'ada@example.com' });
    const confirmado = await t.profile.confirmEmailChange(
      t.tokenDe(t.enviados[0].url),
    );
    expect(confirmado.email).toBe('ada@example.com');

    // Y ahora ya puede ponerse contraseña, sin dar ninguna anterior.
    await t.profile.changePassword(user.id, { newPassword: clave });
    expect(t.users.rows.get(user.id)!.passwordHash).toMatch(/^scrypt\$/);
  });

  it('un correo de otra cuenta se rechaza', async () => {
    const t = build();
    const user = await conCorreo(t);
    await t.users.createWithEmail({
      email: 'ocupado@example.com',
      username: 'otro',
      passwordHash: 'x',
    });
    await expect(
      t.profile.requestEmailChange(user.id, {
        email: 'ocupado@example.com',
        password: clave,
      }),
    ).rejects.toThrow(/ya está en otra cuenta/);
  });

  it('el token solo sirve una vez y pedir otro invalida el anterior', async () => {
    const t = build();
    const user = await conCorreo(t);
    await t.profile.requestEmailChange(user.id, {
      email: 'una@example.com',
      password: clave,
    });
    await t.profile.requestEmailChange(user.id, {
      email: 'dos@example.com',
      password: clave,
    });

    await expect(
      t.profile.confirmEmailChange(t.tokenDe(t.enviados[0].url)),
    ).rejects.toThrow(/ya no sirve/);
    await t.profile.confirmEmailChange(t.tokenDe(t.enviados[1].url));
    expect(t.users.rows.get(user.id)!.email).toBe('dos@example.com');
  });

  it('si el correo no sale, se avisa y no queda a medias', async () => {
    const t = build(true);
    const user = await conCorreo(t);
    await expect(
      t.profile.requestEmailChange(user.id, {
        email: 'nueva@example.com',
        password: clave,
      }),
    ).rejects.toThrow(/No pudimos enviar/);
    expect(t.users.rows.get(user.id)!.email).toBe('ada@example.com');
  });
});

describe('Eliminar la cuenta', () => {
  it('con contraseña: la exige y luego borra', async () => {
    const t = build();
    const user = await conCorreo(t);
    await expect(
      t.profile.deleteAccount(user.id, { password: 'equivocada1' }),
    ).rejects.toThrow(/contraseña actual/);

    await t.profile.deleteAccount(user.id, { password: clave });
    expect(t.users.rows.has(user.id)).toBe(false);
  });

  it('sin contraseña: hay que escribir ELIMINAR', async () => {
    const t = build();
    const user = await t.users.upsertByDiscordId({
      discordId: '42',
      username: 'ada',
      avatarUrl: null,
    });
    await expect(
      t.profile.deleteAccount(user.id, { confirm: 'sí' }),
    ).rejects.toThrow(/Escribe ELIMINAR/);

    await t.profile.deleteAccount(user.id, { confirm: ' eliminar ' });
    expect(t.users.rows.has(user.id)).toBe(false);
  });
});
