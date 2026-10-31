import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Rotulo } from '@talkin/ui';
import { Lixeira, type ItemLixeira } from '@/components/lixeira';
import { DIAS_LIXEIRA } from '@/lib/expurgo';

export const dynamic = 'force-dynamic';

/** SPEC 24: gravações excluídas ficam 30 dias aqui; dá para restaurar ou apagar de vez. */
async function listar(): Promise<ItemLixeira[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('recordings')
    .select('id, title, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);
  return (data as ItemLixeira[] | null) ?? [];
}

export default async function LixeiraPage() {
  const itens = await listar();
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <Rotulo>Biblioteca</Rotulo>
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Lixeira</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            O que você excluir fica aqui por {DIAS_LIXEIRA} dias e depois é apagado de vez.
          </p>
        </div>
        <Link
          href="/biblioteca"
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Voltar
        </Link>
      </header>
      <Lixeira itens={itens} />
    </div>
  );
}
