/**
 * Tipe utility yang dipakai cross-layer.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Bigint ID dalam transport (string, karena JSON tidak support bigint). */
export type IdString = Brand<string, 'IdString'>;

export type Maybe<T> = T | null | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Hasil yang sukses / gagal — pattern Result. */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
