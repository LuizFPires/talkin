'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card, Rotulo } from '@talkin/ui';

type Fase = 'idle' | 'gravando' | 'finalizando';

type Estado = {
  stream?: MediaStream;
  rec?: MediaRecorder;
  recordingId?: string;
  org?: string;
  ext: string;
  index: number;
  cadeia: Promise<void>; // fila sequencial de upload (nunca descarta um bloco)
  timer?: ReturnType<typeof setInterval>;
  acumuladoMs: number; // tempo já gravado (exclui pausas)
  inicioSegmento: number; // início do trecho em execução
};

/** Escolhe um formato suportado pelo navegador (Chrome/Firefox: webm/opus; iOS: mp4). */
function escolherMime(): { mime: string; ext: string } {
  const cands = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of cands) if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function GravarPage() {
  const router = useRouter();
  const configurado = isSupabaseConfigured();
  const [fase, setFase] = useState<Fase>('idle');
  const [pausado, setPausado] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [total, setTotal] = useState(0);
  const [momentos, setMomentos] = useState<number[]>([]);

  const est = useRef<Estado>({
    ext: 'webm',
    index: 0,
    cadeia: Promise.resolve(),
    acumuladoMs: 0,
    inicioSegmento: 0,
  });

  // Para tudo ao sair da tela (não deixa microfone aberto).
  useEffect(() => {
    return () => {
      const e = est.current;
      if (e.timer) clearInterval(e.timer);
      try {
        if (e.rec && e.rec.state !== 'inactive') e.rec.stop();
      } catch {
        // ignora
      }
      e.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Posição atual da gravação em ms (congela quando pausada). */
  function posMs(): number {
    const e = est.current;
    const rodando = e.rec?.state === 'recording';
    return e.acumuladoMs + (rodando ? Date.now() - e.inicioSegmento : 0);
  }

  async function subirBloco(
    supabase: SupabaseClient,
    org: string,
    recId: string,
    index: number,
    blob: Blob,
    ext: string,
  ) {
    const path = `${org}/${recId}/${String(index).padStart(4, '0')}.${ext}`;
    // Retry com backoff: um bloco só sai da fila após confirmação do servidor.
    let tentativa = 0;
    for (;;) {
      const { error } = await supabase.storage
        .from('audio')
        .upload(path, blob, { contentType: blob.type || undefined });
      if (!error) break;
      if (++tentativa >= 5) throw new Error('falha ao enviar um bloco de áudio');
      await new Promise((r) => setTimeout(r, 1000 * tentativa));
    }
    await supabase.from('recording_chunks').insert({
      recording_id: recId,
      index,
      storage_path: path,
      bytes: blob.size,
      uploaded_at: new Date().toISOString(),
    });
    setEnviados((n) => n + 1);
  }

  async function iniciar() {
    setErro(null);
    if (!configurado) {
      setErro('Conecte o Supabase para gravar.');
      return;
    }
    const supabase = createClient();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro('Não consegui acessar o microfone. Permita o acesso e tente de novo.');
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('sessão expirada');
      const { data: m } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const org = m?.organization_id as string | undefined;
      if (!org) throw new Error('empresa não encontrada');

      const { data: rec, error: recErr } = await supabase
        .from('recordings')
        .insert({
          organization_id: org,
          created_by: user.id,
          title: titulo.trim() || '',
          source: 'presencial',
        })
        .select('id')
        .single();
      if (recErr || !rec) throw new Error(recErr?.message ?? 'falha ao criar gravação');

      const { mime, ext } = escolherMime();
      const e = est.current;
      e.stream = stream;
      e.recordingId = rec.id;
      e.org = org;
      e.ext = ext;
      e.index = 0;
      e.cadeia = Promise.resolve();
      e.acumuladoMs = 0;
      e.inicioSegmento = Date.now();
      setEnviados(0);
      setTotal(0);
      setSegundos(0);
      setMomentos([]);
      setPausado(false);

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      e.rec = mr;
      mr.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        const idx = e.index++;
        const blob = ev.data;
        setTotal((n) => n + 1);
        e.cadeia = e.cadeia.then(() => subirBloco(supabase, org, rec.id, idx, blob, ext));
      };
      mr.start(20000); // fecha um bloco a cada 20s (upload incremental)
      e.timer = setInterval(() => setSegundos(Math.floor(posMs() / 1000)), 500);
      setFase('gravando');
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setErro(err instanceof Error ? err.message : 'falha ao iniciar a gravação');
    }
  }

  function pausar() {
    const e = est.current;
    if (!e.rec || e.rec.state !== 'recording') return;
    e.acumuladoMs += Date.now() - e.inicioSegmento;
    try {
      e.rec.pause();
    } catch {
      // ignora
    }
    setPausado(true);
  }

  function retomar() {
    const e = est.current;
    if (!e.rec || e.rec.state !== 'paused') return;
    e.inicioSegmento = Date.now();
    try {
      e.rec.resume();
    } catch {
      // ignora
    }
    setPausado(false);
  }

  function marcarMomento() {
    setMomentos((m) => [...m, Math.floor(posMs())]);
  }

  async function parar() {
    const e = est.current;
    if (!e.rec || !e.recordingId) return;
    setFase('finalizando');
    if (e.timer) clearInterval(e.timer);

    // Para o recorder (dispara o último bloco) e espera a fila confirmar tudo.
    await new Promise<void>((resolve) => {
      e.rec!.onstop = () => resolve();
      try {
        e.rec!.stop();
      } catch {
        resolve();
      }
    });
    e.stream?.getTracks().forEach((t) => t.stop());
    try {
      await e.cadeia;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'um bloco não subiu; a gravação foi salva.');
    }

    const supabase = createClient();
    try {
      if (momentos.length) {
        // Momentos marcados viram destaques da ata (SPEC 5). O guard libera highlights.
        await supabase
          .from('recordings')
          .update({ highlights: momentos.map((atMs) => ({ atMs })) })
          .eq('id', e.recordingId);
      }
      await fetch('/api/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordingId: e.recordingId }),
      });
    } catch {
      // A gravação já está salva; o processamento pode ser retomado na tela dela.
    }
    router.push(`/gravacao/${e.recordingId}`);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 16 }}>
        <Rotulo>Gravar</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Gravar reunião</h1>
      </header>

      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {fase === 'idle' && (
          <>
            <input
              type="text"
              placeholder="Título (opcional)"
              value={titulo}
              onChange={(ev) => setTitulo(ev.target.value)}
              style={campo}
            />
            <button
              type="button"
              onClick={iniciar}
              disabled={!configurado}
              aria-label="Iniciar gravação"
              style={botaoGravar}
            >
              <MicIcon />
            </button>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 13,
                textAlign: 'center',
                margin: 0,
              }}
            >
              Toque para iniciar.{' '}
              <strong style={{ color: 'var(--text)' }}>Avise os participantes</strong> que a reunião
              será gravada.
            </p>
          </>
        )}

        {fase === 'gravando' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={pausado ? 'rec-dot-paused' : 'rec-dot'} />
              <Rotulo>{pausado ? 'Pausado' : 'Gravando'}</Rotulo>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 600 }}>
              {mmss(segundos)}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {enviados}/{total} blocos enviados
              {momentos.length > 0 && ` · ${momentos.length} momento(s)`}
            </span>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={marcarMomento}
                disabled={pausado}
                style={botaoSecundario}
              >
                Marcar momento
              </button>
              <button type="button" onClick={pausado ? retomar : pausar} style={botaoSecundario}>
                {pausado ? 'Retomar' : 'Pausar'}
              </button>
            </div>

            <button type="button" onClick={parar} style={botaoParar}>
              Parar e salvar
            </button>
          </>
        )}

        {fase === 'finalizando' && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              textAlign: 'center',
              margin: '24px 0',
            }}
          >
            Finalizando e enviando os últimos blocos…
          </p>
        )}

        {erro && (
          <span style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }} role="alert">
            {erro}
          </span>
        )}
      </Card>

      {!configurado && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 12 }}>
          Modo só-código: conecte o Supabase para gravar de verdade.
        </p>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="40"
      height="40"
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
  );
}

const campo: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
};

const botaoGravar: React.CSSProperties = {
  width: 128,
  height: 128,
  borderRadius: '50%',
  border: 'none',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 0 0 8px color-mix(in srgb, var(--accent) 16%, transparent)',
};

const botaoParar: React.CSSProperties = {
  padding: '14px 28px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--danger)',
  background: 'transparent',
  color: 'var(--danger)',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

const botaoSecundario: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
};
