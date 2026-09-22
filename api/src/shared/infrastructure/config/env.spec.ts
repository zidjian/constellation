import { loadEnv } from './env';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  WEB_ORIGIN: 'http://localhost:3000',
  JWT_SECRET: 'x'.repeat(32),
  DISCORD_CLIENT_ID: 'id',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_CALLBACK_URL: 'http://localhost:3001/v1/auth/discord/callback',
};

describe('loadEnv', () => {
  it('aplica valores por defecto y trata COOKIE_DOMAIN vacío como ausente', () => {
    const env = loadEnv({ ...valid, COOKIE_DOMAIN: '' });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3001 });
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('falla rápido listando cada variable inválida', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x', PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*WEB_ORIGIN|PORT/,
    );
  });

  it('rechaza el JWT_SECRET de ejemplo en producción', () => {
    const example = 'cambia-esto-por-openssl-rand-hex-32-xxxxxxxxxxxxxxxx';
    expect(() =>
      loadEnv({ ...valid, NODE_ENV: 'production', JWT_SECRET: example }),
    ).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...valid, JWT_SECRET: example })).not.toThrow();
  });
});
