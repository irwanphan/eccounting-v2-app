import { Injectable, Logger } from '@nestjs/common';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import * as bcrypt from 'bcryptjs';

export type SupportedAlgo = 'argon2id' | 'bcrypt';

/** OWASP 2024 recommended argon2id params (19 MiB memory, time cost 2). */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasherService {
  private readonly logger = new Logger(PasswordHasherService.name);

  /**
   * Detect algoritma dari prefix hash.
   *  - $argon2id$  → argon2id
   *  - $2a$, $2b$, $2y$ → bcrypt (semua bcrypt variants)
   */
  detectAlgo(hash: string): SupportedAlgo {
    if (hash.startsWith('$argon2id$')) return 'argon2id';
    if (/^\$2[abxy]\$/.test(hash)) return 'bcrypt';
    throw new Error(`Unknown password hash format: ${hash.slice(0, 12)}...`);
  }

  /** Hash password baru. SELALU pakai argon2id untuk user baru / change password. */
  hash(plaintext: string): Promise<string> {
    return argon2Hash(plaintext, ARGON2_OPTIONS);
  }

  /** Verify password — auto detect algoritma dari hash prefix. */
  async verify(plaintext: string, hashValue: string): Promise<boolean> {
    const algo = this.detectAlgo(hashValue);
    try {
      if (algo === 'argon2id') {
        return await argon2Verify(hashValue, plaintext);
      }
      return await bcrypt.compare(plaintext, hashValue);
    } catch (err) {
      this.logger.warn(`Password verify failed (${algo}): ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Apakah hash perlu di-upgrade ke argon2id?
   * Dipakai untuk lazy migration: kalau user berhasil login dengan bcrypt hash,
   * langsung rehash ke argon2id supaya migrasi v1 → v2 transparan.
   */
  needsRehash(hash: string): boolean {
    return this.detectAlgo(hash) !== 'argon2id';
  }
}
