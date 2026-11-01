'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatBRLFromCents, formatDateBR, plataformaPorUrl } from '@talkin/core';
import { Card, Pilula, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Bot = {
  id: string;
  platform: string;
  meeting_url: string;
  status: 'agendado' | 'entrando' | 'gravando' | 'saiu' | 'erro';
  cost_cents: number;
  recording_id: string | null;
  created_at: string;
};

// Mesmo valor do servidor (env pública), para a prévia bater com o cobrado.
const CUSTO_HORA_CENTS = Number(process.env.NEXT_PUBLIC_BOT_CENTS_PER_HOUR ?? '150');

const PLATAFORMA: Record<string, string> = { meet: 'Google Meet', teams: 'Teams', zoom: 'Zoom' };

const STATUS: Record<Bot['status'], { rotulo: string; dica: string; ativo: boolean }> = {
  agendado: { rotulo: 'Agendado', dica: 'Aguardando o provedor.', ativo: true },
  entrando: {
    rotulo: 'Entrando',
    dica: 'O bot está entrando na reunião. Admita-o se a sala pedir.',
    ativo: true,
  },
  gravando: { rotulo: 'Gravando', dica: 'Na reunião, gravando. Avisou no chat.', ativo: true },
  saiu: {
    rotulo: 'Saiu',
    dica: 'Reunião encerrada. A gravação entra na biblioteca em alguns minutos.',
    ativo: false,
  },
  erro: { rotulo: 'Erro', dica: 'O bot não conseguiu entrar ou gravar.', ativo: false },
};

export default function BotPage() {
  const [url, setUrl] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const configurado = isSupabaseConfigured();
  const plataforma = url ? plataformaPorUrl(url) : null;

  async function carregar() {
    const { data } = await createClient()
      .from('meeting_bots')
      .select('id, platform, meeting_url, status, cost_cents, recording_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setBots((data as Bot[] | null) ?? []);
  }

  useEffect(() => {
    if (configurado) void carregar();
  }, [configurado]);

  // Enquanto houver bot em andamento (ou recém-saído sem gravação), atualiza a cada 10 s.
  const emAndamento = bots.some(
    (b) => STATUS[b.status].ativo || (b.status === 'saiu' && !b.recording_id),
  );
  useEffect(() => {
    if (!configurado || !emAndamento) return;
    const t = setInterval(() => void carregar(), 10_000);
    return () => clearInterval(t);
  }, [configurado, emAndamento]);

  async function agendar() {
    setMsg(null);
    setEnviando(true);
    const res = await fetch('/api/bot/agendar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingUrl: url }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setEnviando(false);
    setMsg(
      res.ok
        ? 'Bot a caminho. Na reunião, admita "Talkin — gravador" se a sala pedir.'
        : (body.error ?? 'Falha ao agendar.'),
    );
    if (res.ok) setUrl('');
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

      <Card style={{ marginBottom: 16 }}>
        <input
          placeholder="Cole o link da reunião (Meet, Teams ou Zoom)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Link da reunião"
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          {plataforma && <Pilula>{PLATAFORMA[plataforma]}</Pilula>}
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Custo estimado: {formatBRLFromCents(CUSTO_HORA_CENTS)}/hora, cobrado pelo tempo em
            chamada
          </span>
          <button
            type="button"
            onClick={() => void agendar()}
            disabled={!plataforma || enviando}
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
            {enviando ? 'Enviando…' : 'Enviar bot'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--label)', marginTop: 8, lineHeight: 1.5 }}>
          O bot entra identificado como &ldquo;Talkin — gravador&rdquo;, avisa no chat que a reunião
          está sendo gravada e sai quando todos saírem. Depois, a gravação aparece na biblioteca com
          transcrição e ata. Sem gravação oculta.
        </p>
        {msg && (
          <p role="status" style={{ color: 'var(--text)', fontSize: 13, margin: '10px 0 0' }}>
            {msg}
          </p>
        )}
      </Card>

      <div style={{ display: 'grid', gap: 8 }}>
        {bots.map((b) => {
          const st = STATUS[b.status];
          return (
            <Card
              key={b.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Pilula>{PLATAFORMA[b.platform] ?? b.platform}</Pilula>
                  <span className={`bot-status ${b.status}`}>
                    <i />
                    {st.rotulo}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatDateBR(b.created_at)}
                    {b.cost_cents > 0 && ` · ${formatBRLFromCents(b.cost_cents)}`}
                  </span>
                </div>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.recording_id ? 'Gravação pronta na biblioteca.' : st.dica}
                </p>
              </div>
              {b.recording_id ? (
                <Link href={`/gravacao/${b.recording_id}`} className="bot-abrir">
                  Abrir gravação
                </Link>
              ) : (
                st.ativo && (
                  <button type="button" onClick={() => void parar(b.id)} className="bot-desligar">
                    Desligar
                  </button>
                )
              )}
            </Card>
          );
        })}
        {bots.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum bot ainda.</p>
        )}
      </div>
    </div>
  );
}
