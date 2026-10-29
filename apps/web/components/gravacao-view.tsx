'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type AtaContent,
  formatBRL,
  formatDateBR,
  formatMinute,
  type RecordingStatus,
} from '@talkin/core';
import { Card, Pilula, Rotulo, ToggleSegmentado } from '@talkin/ui';
import { StatusBadge } from './status-badge';
import { createClient } from '@/lib/supabase/client';

type Seg = { startMs: number; endMs: number; text: string; falante: string };
type Template = { id: string; key: string; name: string };

/** Texto formatado para colar no WhatsApp (SPEC 18). */
function textoWhatsapp(titulo: string, ata: AtaContent): string {
  const linhas = [`*${titulo}*`, '', ata.resumo].filter(Boolean);
  if (ata.extracao.decisoes.length) {
    linhas.push('', '*Decisões*');
    for (const d of ata.extracao.decisoes) linhas.push(`• ${d.texto}`);
  }
  if (ata.extracao.pendencias.length) {
    linhas.push('', '*Pendências*');
    for (const p of ata.extracao.pendencias) {
      linhas.push(
        `• ${p.texto}${p.responsavel ? ` — ${p.responsavel}` : ''}${p.prazo ? ` (${formatDateBR(p.prazo)})` : ''}`,
      );
    }
  }
  return linhas.join('\n');
}

export function GravacaoView({
  recordingId,
  titulo,
  status,
  criadoEm,
  ata,
  segments,
  audioUrl,
  templates,
  templateId,
}: {
  recordingId: string;
  titulo: string;
  status: RecordingStatus;
  criadoEm: string;
  ata: AtaContent | null;
  segments: Seg[];
  audioUrl: string | null;
  templates: Template[];
  templateId: string | null;
}) {
  const router = useRouter();
  const [aba, setAba] = useState('ata');
  const [modelo, setModelo] = useState(templateId ?? '');
  const [regenerando, setRegenerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function regenerar() {
    setRegenerando(true);
    setAviso(null);
    const res = await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordingId, templateId: modelo || null }),
    });
    setRegenerando(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setAviso(b.error ?? 'Falha ao regenerar.');
      return;
    }
    router.refresh();
  }

  async function copiarWhatsapp() {
    if (!ata) return;
    await navigator.clipboard.writeText(textoWhatsapp(titulo, ata));
    setAviso('Texto copiado para o WhatsApp.');
  }

  function enviarEmail() {
    if (!ata) return;
    const corpo = encodeURIComponent(textoWhatsapp(titulo, ata).replace(/\*/g, ''));
    // Abre o cliente de e-mail para o usuário revisar destinatários e texto (SPEC 18).
    window.location.href = `mailto:?subject=${encodeURIComponent(`Ata — ${titulo}`)}&body=${corpo}`;
  }

  async function criarLink(dias: number | null) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(
      /-/g,
      '',
    );
    const expires_at = dias ? new Date(Date.now() + dias * 86400000).toISOString() : null;
    const { error } = await supabase
      .from('shares')
      .insert({ recording_id: recordingId, token, expires_at, created_by: user.id });
    if (error) {
      setAviso(error.message);
      return;
    }
    const url = `${window.location.origin}/compartilhar/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setAviso(`Link copiado (${dias ? `${dias} dias` : 'sem expiração'}): ${url}`);
  }

  function tocarEm(ms: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    void a.play();
  }

  const MinutoPill = ({ ms }: { ms: number }) => (
    <button
      type="button"
      onClick={() => tocarEm(ms)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: audioUrl ? 'pointer' : 'default',
      }}
      disabled={!audioUrl}
      aria-label={`Tocar em ${formatMinute(ms)}`}
    >
      <Pilula mono>{formatMinute(ms)}</Pilula>
    </button>
  );

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 60px' }}>
      <header style={{ marginBottom: 16 }}>
        <Rotulo>Gravação</Rotulo>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 600, flex: 1 }}>{titulo}</h1>
          <StatusBadge status={status} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {formatDateBR(criadoEm)}
        </span>
      </header>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', marginBottom: 16 }} />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <select
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          aria-label="Modelo de ata"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          <option value="">Modelo…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void regenerar()}
          disabled={regenerando}
          style={acaoBtn}
        >
          {regenerando ? 'Regenerando…' : 'Regenerar ata'}
        </button>
        <button type="button" onClick={() => void copiarWhatsapp()} disabled={!ata} style={acaoBtn}>
          Copiar p/ WhatsApp
        </button>
        <a
          href={`/api/pdf?recordingId=${recordingId}`}
          style={{ ...acaoBtn, textDecoration: 'none' }}
        >
          Baixar PDF
        </a>
        <a
          href={`/api/docx?recordingId=${recordingId}`}
          style={{ ...acaoBtn, textDecoration: 'none' }}
        >
          Baixar DOCX
        </a>
        <button type="button" onClick={enviarEmail} disabled={!ata} style={acaoBtn}>
          E-mail
        </button>
        <button type="button" onClick={() => void criarLink(30)} style={acaoBtn}>
          Link privado
        </button>
        {aviso && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
            {aviso}
          </span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <ToggleSegmentado
          value={aba}
          onChange={setAba}
          options={[
            { value: 'ata', label: 'Ata' },
            { value: 'transcricao', label: 'Transcrição' },
            { value: 'pergunte', label: 'Pergunte' },
          ]}
        />
      </div>

      {aba === 'ata' && <AbaAta ata={ata} MinutoPill={MinutoPill} />}
      {aba === 'transcricao' && <AbaTranscricao segments={segments} MinutoPill={MinutoPill} />}
      {aba === 'pergunte' && (
        <Card>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Perguntar com citação (gravação + minuto) entra no M5.
          </p>
        </Card>
      )}
    </div>
  );
}

function AbaAta({
  ata,
  MinutoPill,
}: {
  ata: AtaContent | null;
  MinutoPill: (p: { ms: number }) => React.ReactNode;
}) {
  if (!ata) {
    return (
      <Card>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Ata ainda não disponível. Ela aparece quando o processamento termina.
        </p>
      </Card>
    );
  }
  const { extracao } = ata;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {ata.resumo && (
        <Card>
          <Rotulo>Resumo</Rotulo>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5 }}>{ata.resumo}</p>
        </Card>
      )}
      {ata.secoes.map((s) => (
        <Card key={s.key}>
          <Rotulo>{s.title}</Rotulo>
          <p style={{ margin: '8px 0 6px', fontSize: 15, lineHeight: 1.5 }}>{s.body}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {s.minutos_ms.map((ms, i) => (
              <MinutoPill key={i} ms={ms} />
            ))}
          </div>
        </Card>
      ))}

      {extracao.decisoes.length > 0 && (
        <Card>
          <Rotulo>Decisões</Rotulo>
          <ul style={lista}>
            {extracao.decisoes.map((d, i) => (
              <li key={i} style={item}>
                <span>{d.texto}</span>
                {d.minuto_ms !== null && <MinutoPill ms={d.minuto_ms} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {extracao.pendencias.length > 0 && (
        <Card>
          <Rotulo>Pendências</Rotulo>
          <ul style={lista}>
            {extracao.pendencias.map((p, i) => (
              <li key={i} style={item}>
                <span>
                  {p.texto} <Pilula>{p.responsavel ?? 'sem responsável'}</Pilula>
                </span>
                {p.minuto_ms !== null && <MinutoPill ms={p.minuto_ms} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {extracao.valores.length > 0 && (
        <Card>
          <Rotulo>Valores</Rotulo>
          <ul style={lista}>
            {extracao.valores.map((v, i) => (
              <li key={i} style={item}>
                <span>
                  {v.descricao} —{' '}
                  {v.unidade === 'R$'
                    ? formatBRL(v.valor)
                    : `${v.valor.toLocaleString('pt-BR')} ${v.unidade}`}
                </span>
                {v.minuto_ms !== null && <MinutoPill ms={v.minuto_ms} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AbaTranscricao({
  segments,
  MinutoPill,
}: {
  segments: Seg[];
  MinutoPill: (p: { ms: number }) => React.ReactNode;
}) {
  if (!segments.length) {
    return (
      <Card>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Transcrição ainda não disponível.
        </p>
      </Card>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {segments.map((s, i) => (
        <Card key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 92 }}>
            <MinutoPill ms={s.startMs} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.falante}</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{s.text}</p>
        </Card>
      ))}
    </div>
  );
}

const acaoBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
};

const lista: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '8px 0 0',
  display: 'grid',
  gap: 8,
};
const item: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'baseline',
  fontSize: 14,
};
