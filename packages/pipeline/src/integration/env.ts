import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carrega apps/web/.env.local (gitignored) no process.env para os testes de
 * integração com provedores reais. Sem o arquivo ou sem a chave, os testes são
 * pulados — o CI continua verde e sem segredos. Nunca imprime valores.
 */
export function carregarEnvLocal(): void {
  const p = resolve(__dirname, '../../../../apps/web/.env.local');
  if (!existsSync(p)) return;
  for (const linha of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m) continue;
    const k = m[1]!;
    let v = m[2]!;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

export function temChave(nome: string): boolean {
  carregarEnvLocal();
  return Boolean(process.env[nome]);
}
