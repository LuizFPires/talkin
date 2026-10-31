'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Rotulo } from '@talkin/ui';

/** Trecho final da transcrição ao vivo (mesmo formato do /gravar). */
export type TrechoTrilha = { speaker: number; startMs: number; endMs: number; text: string };

/** Etapas reais do encerramento em /gravar. */
export type EtapaFinal = 0 | 1 | 2; // 0 encerrando · 1 enviando blocos · 2 gerando a ata

type Props = {
  etapa: EtapaFinal;
  /** Texto da etapa (ex.: "Gerando a ata…" ou "Processando o áudio…"). */
  mensagem: string;
  /** Ata chegou: completa a trilha e a barra. */
  pronto: boolean;
  trechos: TrechoTrilha[];
  momentosMs: number[];
  duracaoMs: number;
  /** Níveis RMS (0–1) amostrados durante a gravação; opcional. */
  niveis: number[];
  /** Motivo curto quando a geração falhou; a Trilha fica na tela e oferece tentar de novo. */
  falha?: string | null;
  /** Não houve transcrição ao vivo (caminho antigo: processar o áudio). */
  semLive?: boolean;
  onTentar?: () => void;
  onAbrir?: () => void;
};

const ETAPAS = ['Encerrando', 'Enviando', 'Relendo'] as const;

/**
 * Tela de espera "A Trilha": a reunião vira uma linha do tempo com a onda do
 * áudio; enquanto a ata é gerada, um cursor relê a gravação em alta velocidade,
 * mostra o trecho daquele minuto, para nos momentos marcados e acende um
 * checklist das seções da ata. Tudo aqui já está na tela do usuário — nada novo
 * é transmitido nem registrado.
 *
 * Progresso honesto: etapas 0 e 1 são medidas; a 2 (Claude escrevendo) não tem
 * progresso real, então a barra avança por tempo e para em ~92% até `pronto`.
 */
export function GerandoAta({
  etapa,
  mensagem,
  pronto,
  trechos,
  momentosMs,
  duracaoMs,
  niveis,
  falha = null,
  semLive = false,
  onTentar,
  onAbrir,
}: Props) {
  const [t, setT] = useState(0); // ms desde que a etapa 2 começou
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduzido = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Relógio da releitura (só na etapa 2).
  useEffect(() => {
    if (etapa < 2 || pronto || falha) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setT(now - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [etapa, pronto, falha]);

  // Releitura: percorre a reunião em ~9 s e freia perto do fim até a ata chegar.
  const dur = Math.max(duracaoMs, 1000);
  const fracao = pronto
    ? 1
    : etapa < 2
      ? 0
      : Math.min(0.95, 1 - Math.pow(1 - Math.min(t / 9000, 1), 1.6));
  const pos = fracao * dur;

  // Barra de fases: 0→15% · 15→35% · 35→92% (assíntota) · pronto 100%.
  const progresso = pronto
    ? 100
    : etapa === 0
      ? 8
      : etapa === 1
        ? 24
        : 35 + 57 * (1 - Math.pow(1 - Math.min(t / 14000, 1), 2.2));

  // Trecho "sendo ouvido" neste instante.
  const atual = useMemo(() => {
    if (etapa < 2) return null;
    let ult: TrechoTrilha | null = null;
    for (const tr of trechos) {
      if (tr.startMs <= pos) ult = tr;
      else break;
    }
    return ult;
  }, [trechos, pos, etapa]);
  const noMomento = momentosMs.some((m) => Math.abs(m - pos) < 15000);

  // Seções da ata acendem conforme a releitura avança.
  const secoes = useMemo(() => {
    const base = [
      { nome: 'Resumo executivo', em: 0.3, qtd: '' },
      { nome: 'Decisões', em: 0.55, qtd: '' },
      { nome: 'Pendências e responsáveis', em: 0.75, qtd: '' },
      { nome: 'Valores e prazos', em: 0.9, qtd: '' },
    ];
    if (momentosMs.length) {
      base.push({ nome: 'Momentos marcados', em: 0.95, qtd: String(momentosMs.length) });
    }
    return base;
  }, [momentosMs.length]);

  // Onda: níveis reais do microfone; sem eles, presença de fala por intervalo.
  const barras = useMemo(() => {
    const N = 120;
    if (niveis.length >= 8) {
      const out: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = Math.floor((i / N) * niveis.length);
        const b = Math.max(a + 1, Math.floor(((i + 1) / N) * niveis.length));
        let m = 0;
        for (let k = a; k < b; k++) m = Math.max(m, niveis[k] ?? 0);
        out.push(m);
      }
      const max = Math.max(0.05, ...out);
      return out.map((v) => 0.08 + 0.9 * (v / max));
    }
    const out = new Array<number>(N).fill(0.1);
    for (const tr of trechos) {
      const a = Math.floor((tr.startMs / dur) * N);
      const b = Math.min(N - 1, Math.floor((tr.endMs / dur) * N));
      for (let i = a; i <= b; i++) out[i] = 0.55 + 0.35 * Math.abs(Math.sin(i * 1.7));
    }
    return out;
  }, [niveis, trechos, dur]);

  // Desenha a onda (parte já relida em menta).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width;
    const H = cv.height;
    const css = getComputedStyle(cv);
    const menta = css.getPropertyValue('--accent').trim() || '#94efda';
    const apagado = css.getPropertyValue('--border').trim() || '#2b2b2b';
    ctx.clearRect(0, 0, W, H);
    const bw = W / barras.length;
    barras.forEach((amp, i) => {
      const h = Math.max(2, amp * H * 0.9);
      ctx.fillStyle = i / barras.length <= fracao ? menta : apagado;
      ctx.fillRect(i * bw + 1, (H - h) / 2, Math.max(1, bw - 2), h);
    });
  }, [barras, fracao]);

  return (
    <div
      style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}
      aria-live="polite"
    >
      {/* Barra de fases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso)}
          aria-label="Progresso da ata"
          style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progresso.toFixed(1)}%`,
              background: 'var(--accent)',
              borderRadius: 3,
              transition: reduzido ? 'none' : 'width .4s linear',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ETAPAS.map((nome, i) => {
            const ativa = !pronto && i === etapa;
            const feita = pronto || i < etapa;
            return (
              <span
                key={nome}
                className={ativa ? 'trilha-etapa trilha-etapa-ativa' : 'trilha-etapa'}
                style={{
                  color: ativa ? 'var(--text)' : feita ? 'var(--text-secondary)' : undefined,
                }}
              >
                {feita && <span style={{ color: 'var(--accent)' }}>✓ </span>}
                {nome}
              </span>
            );
          })}
        </div>
      </div>

      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          {pronto ? 'Ata pronta' : mensagem}
        </p>
        <span className="trilha-pilula">{pronto ? '✓' : etapa === 2 ? '20×' : '—'}</span>
      </div>

      {/* Linha do tempo com a onda */}
      <div
        style={{
          position: 'relative',
          height: 84,
          borderRadius: 'var(--radius-menu)',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          style={{ width: '100%', height: '100%', display: 'block' }}
          aria-hidden="true"
        />
        {momentosMs.map((m, i) => (
          <span
            key={i}
            className="trilha-momento"
            style={{ left: `${Math.min(100, (m / dur) * 100)}%` }}
            title="Momento marcado"
          />
        ))}
        <span className="trilha-cursor" style={{ left: `${fracao * 100}%` }} />
      </div>

      {/* O que está sendo "ouvido" agora */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44 }}>
        <span className="trilha-pilula">{mmss(pos / 1000)}</span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
          {pronto ? (
            <>
              <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>Ata pronta.</strong>{' '}
              Abrindo a gravação…
            </>
          ) : etapa === 0 ? (
            'Fechando o microfone com cuidado…'
          ) : etapa === 1 ? (
            'Guardando os últimos segundos de áudio…'
          ) : atual ? (
            <>
              {noMomento && <span style={{ color: 'var(--accent)' }}>★ Momento marcado · </span>}
              <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Falante {atual.speaker + 1}
              </strong>{' '}
              {atual.text}
            </>
          ) : trechos.length ? (
            'Relendo a reunião do começo…'
          ) : (
            'Ouvindo o áudio gravado…'
          )}
        </p>
      </div>

      {/* Checklist das seções da ata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Rotulo>Seções da ata</Rotulo>
        {secoes.map((s) => {
          const ok = pronto || (etapa === 2 && fracao >= s.em);
          const indo = !ok && etapa === 2 && fracao >= s.em - 0.18;
          return (
            <div
              key={s.nome}
              className={`trilha-secao${ok ? ' trilha-secao-ok' : indo ? ' trilha-secao-indo' : ''}`}
            >
              <span className="trilha-ponto" aria-hidden="true">
                {ok ? '✓' : ''}
              </span>
              <span style={{ flex: 1 }}>{s.nome}</span>
              {ok && s.qtd && <span className="trilha-pilula">{s.qtd}</span>}
            </div>
          );
        })}
      </div>

      {falha ? (
        <div className="trilha-falha" role="alert">
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
            {semLive ? 'Não consegui processar o áudio.' : 'Não consegui gerar a ata.'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            A gravação{semLive ? '' : ' e a transcrição'} já{' '}
            {semLive ? 'está salva' : 'estão salvas'}. Motivo:{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>{falha}</code>
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="trilha-botao" onClick={onTentar}>
              Tentar de novo
            </button>
            <button type="button" className="trilha-botao-sec" onClick={onAbrir}>
              Abrir gravação mesmo assim
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0, textAlign: 'center' }}>
          {etapa === 2 && !pronto
            ? 'A transcrição já está salva. A ata leva poucos segundos.'
            : 'Não feche esta tela até a ata ficar pronta.'}
        </p>
      )}
    </div>
  );
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
