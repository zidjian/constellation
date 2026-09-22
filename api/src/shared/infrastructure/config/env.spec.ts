import { loadEnv } from './env';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  WEB_ORIGIN: 'http://localhost:3000',
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
});
