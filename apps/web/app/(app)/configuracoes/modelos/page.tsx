'use client';

import { useEffect, useState } from 'react';
import { Card, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Secao = { key: string; title: string; instructions?: string };
type Template = {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  sections: Secao[];
};

const campo: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
};
const botao: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default function ModelosPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
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
      .from('templates')
      .select('id, organization_id, key, name, sections')
      .order('name', { ascending: true });
    setTemplates((data as Template[] | null) ?? []);
  }

  useEffect(() => {
    if (configurado) void carregar();
  }, [configurado]);

  async function novo() {
    if (!orgId) return;
    const supabase = createClient();
    const { error } = await supabase.from('templates').insert({
      organization_id: orgId,
      key: `modelo-${Date.now()}`,
      name: 'Novo modelo',
      sections: [{ key: 'resumo', title: 'Resumo' }],
    });
    setMsg(error ? error.message : 'Modelo criado.');
    await carregar();
  }

  async function salvar(t: Template) {
    const supabase = createClient();
    const { error } = await supabase
      .from('templates')
      .update({ name: t.name, sections: t.sections })
      .eq('id', t.id);
    setMsg(error ? error.message : 'Modelo salvo.');
  }

  async function excluir(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('templates').delete().eq('id', id);
    setMsg(error ? error.message : 'Modelo excluído.');
    await carregar();
  }

  function atualizar(id: string, patch: Partial<Template>) {
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Modelos de ata</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>Conecte o Supabase para editar modelos.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 20,
        }}
      >
        <div>
          <Rotulo>Modelos de ata</Rotulo>
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Modelos</h1>
        </div>
        <button style={botao} onClick={() => void novo()}>
          Novo modelo
        </button>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {templates.map((t) => {
          const editavel = t.organization_id !== null;
          return (
            <Card key={t.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <input
                  style={{ ...campo, fontWeight: 600 }}
                  value={t.name}
                  disabled={!editavel}
                  onChange={(e) => atualizar(t.id, { name: e.target.value })}
                />
                {!editavel && <Rotulo>Global</Rotulo>}
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {t.sections.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={campo}
                      value={s.title}
                      disabled={!editavel}
                      placeholder="Título da seção"
                      onChange={(e) =>
                        atualizar(t.id, {
                          sections: t.sections.map((x, j) =>
                            j === i ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      style={campo}
                      value={s.instructions ?? ''}
                      disabled={!editavel}
                      placeholder="Instruções (opcional)"
                      onChange={(e) =>
                        atualizar(t.id, {
                          sections: t.sections.map((x, j) =>
                            j === i ? { ...x, instructions: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {editavel && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    style={{
                      ...botao,
                      background: 'transparent',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                    onClick={() =>
                      atualizar(t.id, {
                        sections: [
                          ...t.sections,
                          { key: `s${t.sections.length}`, title: 'Nova seção' },
                        ],
                      })
                    }
                  >
                    + Seção
                  </button>
                  <button style={botao} onClick={() => void salvar(t)}>
                    Salvar
                  </button>
                  <button
                    style={{
                      ...botao,
                      background: 'transparent',
                      color: 'var(--danger)',
                      border: '1px solid var(--border)',
                    }}
                    onClick={() => void excluir(t.id)}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
