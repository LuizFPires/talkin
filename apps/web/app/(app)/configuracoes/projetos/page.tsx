'use client';

import { useEffect, useState } from 'react';
import { Card, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Projeto = { id: string; name: string };

const campo: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  flex: 1,
};
const botao: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [novo, setNovo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const configurado = isSupabaseConfigured();

  async function carregar() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setOrgId((m?.organization_id as string) ?? null);
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    setProjetos((data as Projeto[] | null) ?? []);
  }

  useEffect(() => {
    if (configurado) void carregar();
  }, [configurado]);

  async function criar() {
    if (!orgId || !novo.trim()) return;
    const { error } = await createClient()
      .from('projects')
      .insert({ organization_id: orgId, name: novo.trim() });
    setMsg(error ? 'Não foi possível criar.' : 'Projeto criado.');
    setNovo('');
    await carregar();
  }

  async function excluir(id: string) {
    // Soft-delete (lixeira), não apaga de fato.
    const { error } = await createClient()
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    setMsg(error ? 'Não foi possível excluir.' : 'Projeto removido.');
    await carregar();
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Projetos / obras</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>
          Conecte o Supabase para gerenciar projetos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Projetos / obras</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Projetos</h1>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={campo}
            placeholder="Nome do projeto/obra"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
          />
          <button style={botao} onClick={() => void criar()}>
            Adicionar
          </button>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 8 }}>
        {projetos.map((p) => (
          <Card
            key={p.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ fontSize: 15 }}>{p.name}</span>
            <button
              type="button"
              onClick={() => void excluir(p.id)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--danger)',
                fontSize: 12,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Remover
            </button>
          </Card>
        ))}
        {projetos.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum projeto ainda.</p>
        )}
      </div>
    </div>
  );
}
