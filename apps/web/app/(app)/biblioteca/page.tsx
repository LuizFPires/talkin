import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card, Rotulo } from '@talkin/ui';
import { BuscaLivre } from '@/components/busca-livre';
import { ListaGravacoes, type LinhaGravacao } from '@/components/lista-gravacoes';

export const dynamic = 'force-dynamic';

async function listar(): Promise<LinhaGravacao[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('recordings')
    .select('id, title, status, source, duration_s, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as LinhaGravacao[] | null) ?? [];
}

export default async function BibliotecaPage() {
  const gravacoes = await listar();
  const configurado = isSupabaseConfigured();

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <Rotulo>Biblioteca</Rotulo>
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Reuniões</h1>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link
            href="/importar"
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Importar áudio
          </Link>
          <Link
            href="/lixeira"
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Lixeira
          </Link>
        </div>
      </header>

      {configurado && <BuscaLivre />}

      {!configurado && (
        <Card style={{ marginBottom: 16 }}>
          <Rotulo>Modo só-código</Rotulo>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '8px 0 0' }}>
            Conecte o Supabase (variáveis de ambiente) para criar e listar gravações de verdade.
          </p>
        </Card>
      )}

      {gravacoes.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Nenhuma reunião ainda. Toque em{' '}
            <Link href="/gravar" style={{ color: 'var(--accent)' }}>
              Gravar
            </Link>{' '}
            ou importe um áudio.
          </p>
        </Card>
      ) : (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
            Arraste uma reunião para a esquerda para excluir.
          </p>
          <ListaGravacoes itens={gravacoes} />
        </>
      )}
    </div>
  );
}
