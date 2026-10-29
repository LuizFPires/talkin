'use client';

import { useRef, useState } from 'react';
import { type AtaContent, formatDateBR, formatMinute, type RecordingStatus } from '@talkin/core';
import { Card, Pilula, Rotulo, ToggleSegmentado } from '@talkin/ui';
import { StatusBadge } from './status-badge';

type Seg = { startMs: number; endMs: number; text: string; falante: string };

export function GravacaoView({
  titulo,
  status,
  criadoEm,
  ata,
  segments,
  audioUrl,
}: {
  titulo: string;
  status: RecordingStatus;
  criadoEm: string;
  ata: AtaContent | null;
  segments: Seg[];
  audioUrl: string | null;
}) {
  const [aba, setAba] = useState('ata');
  const audioRef = useRef<HTMLAudioElement>(null);

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
                  {v.descricao} — {v.valor} {v.unidade}
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
