'use client';

import { useEffect, useState } from 'react';
import { Card, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Pessoa = {
  id: string;
  name: string;
  empresa: string | null;
  papel: string | null;
  contato: string | null;
};

const campo: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  flex: 1,
  minWidth: 120,
};
const botao: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [podeEditar, setPodeEditar] = useState(false);
  const [nova, setNova] = useState({ name: '', empresa: '', papel: '', contato: '' });
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
      .select('organization_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setOrgId((m?.organization_id as string) ?? null);
    setPodeEditar(m?.role === 'admin' || m?.role === 'gestor');
    const { data } = await supabase
      .from('people')
      .select('id, name, empresa, papel, contato')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    setPessoas((data as Pessoa[] | null) ?? []);
  }

  useEffect(() => {
    if (configurado) void carregar();
  }, [configurado]);

  async function criar() {
    if (!orgId || !nova.name.trim()) return;
    const { error } = await createClient()
      .from('people')
      .insert({
        organization_id: orgId,
        name: nova.name.trim(),
        empresa: nova.empresa || null,
        papel: nova.papel || null,
        contato: nova.contato || null,
      });
    setMsg(error ? 'Não foi possível adicionar.' : 'Pessoa adicionada.');
    setNova({ name: '', empresa: '', papel: '', contato: '' });
    await carregar();
  }

  async function excluir(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('people')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    // Soft-delete: limpa as referências (o on delete set null só vale em delete físico).
    await supabase.from('speakers').update({ person_id: null }).eq('person_id', id);
    await supabase
      .from('action_items')
      .update({ assignee_person_id: null })
      .eq('assignee_person_id', id);
    setMsg(error ? 'Não foi possível remover.' : 'Pessoa removida.');
    await carregar();
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Pessoas</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>Conecte o Supabase para cadastrar pessoas.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Pessoas</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Cadastro de pessoas</h1>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}
      {!podeEditar && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Só gestor/administrador cadastra pessoas.
        </p>
      )}

      {podeEditar && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              style={campo}
              placeholder="Nome"
              value={nova.name}
              onChange={(e) => setNova({ ...nova, name: e.target.value })}
            />
            <input
              style={campo}
              placeholder="Empresa"
              value={nova.empresa}
              onChange={(e) => setNova({ ...nova, empresa: e.target.value })}
            />
            <input
              style={campo}
              placeholder="Papel"
              value={nova.papel}
              onChange={(e) => setNova({ ...nova, papel: e.target.value })}
            />
            <input
              style={campo}
              placeholder="Contato"
              value={nova.contato}
              onChange={(e) => setNova({ ...nova, contato: e.target.value })}
            />
            <button style={botao} onClick={() => void criar()}>
              Adicionar
            </button>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {pessoas.map((p) => (
          <Card
            key={p.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ fontSize: 14 }}>
              {p.name}
              {(p.empresa || p.papel) && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {' '}
                  · {[p.papel, p.empresa].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {podeEditar && (
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
            )}
          </Card>
        ))}
        {pessoas.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhuma pessoa cadastrada.</p>
        )}
      </div>
    </div>
  );
}
