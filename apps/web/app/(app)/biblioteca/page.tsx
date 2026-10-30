import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { formatDateBR, type RecordingSource, type RecordingStatus } from '@talkin/core';
import { Card, Rotulo, Pilula } from '@talkin/ui';
import { StatusBadge } from '@/components/status-badge';
import { BuscaLivre } from '@/components/busca-livre';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  title: string;
  status: RecordingStatus;
  source: RecordingSource;
  duration_s: number | null;
  created_at: string;
};

const ORIGEM: Record<RecordingSource, string> = {
  presencial: 'Presencial',
  meet: 'Meet',
  teams: 'Teams',
  zoom: 'Zoom',
  whatsapp: 'WhatsApp',
  importado: 'Importado',
  outro: 'Outro',
};

async function listar(): Promise<Row[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('recordings')
    .select('id, title, status, source, duration_s, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as Row[] | null) ?? [];
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
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Gravações</h1>
        </div>
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
      </header>

      {/* Ação principal: gravar. Grande e óbvio — é o que o app faz primeiro. */}
      <Link
        href="/gravar"
        aria-label="Gravar reunião"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '22px 24px',
          marginBottom: 16,
          borderRadius: 'var(--radius-card)',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontWeight: 700,
          fontSize: 18,
          textDecoration: 'none',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
        Gravar reunião
      </Link>

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
            Nenhuma gravação ainda. Crie uma nova ou importe um áudio.
          </p>
        </Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {gravacoes.map((g) => (
            <li key={g.id}>
              <Link href={`/gravacao/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Pilula>{ORIGEM[g.source]}</Pilula>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatDateBR(g.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 15 }}>
                      {g.title.trim() || 'Sem título'}
                    </p>
                  </div>
                  <StatusBadge status={g.status} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
