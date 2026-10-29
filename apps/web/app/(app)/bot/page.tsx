'use client';

import { useEffect, useState } from 'react';
import { formatBRLFromCents, plataformaPorUrl } from '@talkin/core';
import { Card, Pilula, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Bot = {
  id: string;
  platform: string;
  meeting_url: string;
  status: string;
  cost_cents: number;
};

// Mesmo valor do servidor (env pública), para a prévia bater com o cobrado.
const CUSTO_HORA_CENTS = Number(process.env.NEXT_PUBLIC_BOT_CENTS_PER_HOUR ?? '150');

export default function BotPage() {
  const [url, setUrl] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const configurado = isSupabaseConfigured();
  const plataforma = url ? plataformaPorUrl(url) : null;

  async function carregar() {
    const { data } = await createClient()
      .from('meeting_bots')
      .select('id, platform, meeting_url, status, cost_cents')
      .order('created_at', { ascending: false })
      .limit(50);
    setBots((data as Bot[] | null) ?? []);
  }

  useEffect(() => {
    if (configurado) void carregar();
  }, [configurado]);

  async function agendar() {
    setMsg(null);
    const res = await fetch('/api/bot/agendar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingUrl: url }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? 'Bot agendado.' : (body.error ?? 'Falha ao agendar.'));
    setUrl('');
    await carregar();
  }

  async function parar(botId: string) {
    await fetch('/api/bot/parar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    await carregar();
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Bot de reunião</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>Conecte o Supabase para usar o bot.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Bot de reunião</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>
          Enviar o Talkin para uma reunião
        </h1>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}

      <Card style={{ marginBottom: 16 }}>
        <input
          placeholder="Cole o link da reunião (Meet, Teams ou Zoom)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-menu)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          {plataforma && <Pilula>{plataforma}</Pilula>}
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Custo estimado: {formatBRLFromCents(CUSTO_HORA_CENTS)}/hora
          </span>
          <button
            type="button"
            onClick={() => void agendar()}
            disabled={!plataforma}
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--accent)',
              background: plataforma ? 'var(--accent)' : 'transparent',
              color: plataforma ? 'var(--on-accent)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: plataforma ? 'pointer' : 'not-allowed',
            }}
          >
            Enviar bot
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--label)', marginTop: 8 }}>
          O bot entra identificado como "Talkin — gravador" e avisa no chat. Sem gravação oculta.
        </p>
      </Card>

      <div style={{ display: 'grid', gap: 8 }}>
        {bots.map((b) => (
          <Card
            key={b.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pilula>{b.platform}</Pilula>
                <Pilula>{b.status}</Pilula>
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {b.meeting_url}
              </p>
            </div>
            {['agendado', 'entrando', 'gravando'].includes(b.status) && (
              <button
                type="button"
                onClick={() => void parar(b.id)}
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
                Desligar
              </button>
            )}
          </Card>
        ))}
        {bots.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum bot ainda.</p>
        )}
      </div>
    </div>
  );
}
