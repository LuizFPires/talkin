/**
 * Validação de UUID canônico. O regex antigo `/^[0-9a-f-]{36}$/` aceitava
 * qualquer string de 36 chars com hex/hífen (ex.: "------...") — enganoso.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
