'use client';

import { useEffect, useState } from 'react';
import { Card, Rotulo } from '@talkin/ui';
import type { RegraCalendario } from '@talkin/core';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const campo: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
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

export default function IntegracoesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [importMeet, setImportMeet] = useState(false);
  const [regras, setRegras] = useState<RegraCalendario[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const configurado = isSupabaseConfigured();

  useEffect(() => {
    if (!configurado) return;
    const supabase = createClient();
    void (async () => {
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
      const org = (m?.organization_id as string) ?? null;
      setOrgId(org);
      setIsAdmin(m?.role === 'admin');
      if (org) {
        const { data } = await supabase
          .from('integrations')
          .select('ioo_webhook_url, webhook_secret, import_meet_teams, calendar_rules')
          .eq('organization_id', org)
          .maybeSingle();
        if (data) {
          setUrl((data.ioo_webhook_url as string) ?? '');
          setSecret((data.webhook_secret as string) ?? '');
          setImportMeet((data.import_meet_teams as boolean) ?? false);
          setRegras((data.calendar_rules as RegraCalendario[]) ?? []);
        }
      }
    })();
  }, [configurado]);

  async function salvar() {
    if (!orgId) return;
    const { error } = await createClient()
      .from('integrations')
      .upsert(
        {
          organization_id: orgId,
          ioo_webhook_url: url || null,
          webhook_secret: secret || null,
          import_meet_teams: importMeet,
          calendar_rules: regras,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );
    setMsg(error ? 'Não foi possível salvar.' : 'Integrações salvas.');
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Integrações</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>
          Conecte o Supabase para configurar integrações.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Integrações</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Integrações</h1>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}
      {!isAdmin && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Só administradores alteram integrações.
        </p>
      )}

      <Card style={{ marginBottom: 12 }}>
        <Rotulo>ioo / Webhook</Rotulo>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '6px 0 10px' }}>
          Ao marcar a ata como Revisada, as decisões e pendências são enviadas (POST assinado) para
          esta URL.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            style={campo}
            disabled={!isAdmin}
            placeholder="https://… (URL do webhook)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            style={campo}
            disabled={!isAdmin}
            placeholder="Segredo (assinatura HMAC)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button style={botao} disabled={!isAdmin} onClick={() => void salvar()}>
            Salvar
          </button>
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Rotulo>Agenda e importação</Rotulo>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '6px 0 10px' }}>
          Conectar Google/Microsoft e importar gravações do Meet/Teams exige autorização (OAuth).
          Disponível ao configurar as credenciais.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              ...botao,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'not-allowed',
            }}
            disabled
          >
            Conectar Google
          </button>
          <button
            style={{
              ...botao,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'not-allowed',
            }}
            disabled
          >
            Conectar Microsoft
          </button>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={importMeet}
            onChange={(e) => setImportMeet(e.target.checked)}
          />
          Importar gravações do Meet/Teams automaticamente (quando conectado)
        </label>
      </Card>
    </div>
  );
}
