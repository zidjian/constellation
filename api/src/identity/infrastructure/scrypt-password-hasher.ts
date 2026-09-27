import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import type { PasswordHasher } from '../domain/ports';

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// Parámetros de scrypt: N=2^15 tarda ~100 ms en el servidor y encarece mucho el ataque por diccionario.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

/**
 * scrypt del propio Node: sin dependencias nativas (argon2 y bcrypt obligan a compilar, y pnpm
 * tiene los build scripts desactivados). El formato guarda los parámetros, así que subirlos más
 * adelante no invalida los hashes viejos.
 *   scrypt$N$r$p$saltBase64$hashBase64
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password.normalize('NFKC'), salt, KEYLEN, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, keyB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    if (!salt.length || !expected.length) return false;
    try {
      const actual = await derive(
        password.normalize('NFKC'),
        salt,
        expected.length,
        {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem: PARAMS.maxmem,
        },
      );
      return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
      );
    } catch {
      return false;
    }
  }
}
