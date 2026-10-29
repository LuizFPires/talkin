/** Formatação brasileira (R$ 1.234,56 e dd/mm/aaaa). */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Centavos inteiros → "R$ 1.234,56". */
export function formatBRLFromCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Reais em número → "R$ 1.234,56". */
export function formatBRL(value: number): string {
  return brl.format(value);
}

/** Data ISO ou Date → "dd/mm/aaaa". */
export function formatDateBR(input: string | Date): string {
  let d: Date;
  if (typeof input === 'string') {
    // Data só-data (YYYY-MM-DD) é interpretada como local, sem deslocar o fuso.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(input);
  } else {
    d = input;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Milissegundos → "mm:ss" ou "h:mm:ss" (pílula de minuto). */
export function formatMinute(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
