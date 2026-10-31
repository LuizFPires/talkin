'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card, Rotulo } from '@talkin/ui';

type Fase = 'idle' | 'gravando' | 'finalizando';

/** Trecho final da transcrição ao vivo (falante por índice do diarizador). */
type Trecho = { speaker: number; startMs: number; endMs: number; text: string };

type Estado = {
  stream?: MediaStream;
  rec?: MediaRecorder; // blocos de 20s → upload (arquivo/player)
  recLive?: MediaRecorder; // blocos de 250ms → Deepgram Live
  ws?: WebSocket;
  wsTentativas: number;
  keepAlive?: ReturnType<typeof setInterval>;
  recordingId?: string;
  org?: string;
  ext: string;
  mime: string;
  index: number;
  cadeia: Promise<void>; // fila sequencial de upload (nunca descarta um bloco)
  timer?: ReturnType<typeof setInterval>;
  flushTimer?: ReturnType<typeof setInterval>;
  fila: Trecho[]; // trechos finais aguardando persistência
  flushing: Promise<void>;
  acumuladoMs: number; // tempo já gravado (exclui pausas)
  inicioSegmento: number;
};

const LIVE_PARAMS = new URLSearchParams({
  model: 'nova-2',
  language: 'pt-BR',
  diarize: 'true',
  punctuate: 'true',
  smart_format: 'true',
  interim_results: 'true',
  utterance_end_ms: '1200',
});

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

type PalavraDG = {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  speaker?: number;
};
type ResultadoDG = {
  type?: string;
  is_final?: boolean;
  start?: number;
  duration?: number;
  channel?: { alternatives?: { transcript?: string; words?: PalavraDG[] }[] };
};

/** Agrupa palavras consecutivas do mesmo falante em trechos. */
function agruparPorFalante(words: PalavraDG[]): Trecho[] {
  const out: Trecho[] = [];
  for (const w of words) {
    const sp = w.speaker ?? 0;
    const txt = w.punctuated_word ?? w.word;
    const ult = out[out.length - 1];
    if (ult && ult.speaker === sp) {
      ult.text += ` ${txt}`;
      ult.endMs = Math.round(w.end * 1000);
    } else {
      out.push({
        speaker: sp,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        text: txt,
      });
    }
  }
  return out;
}

export default function GravarPage() {
  const router = useRouter();
  const configurado = isSupabaseConfigured();
  const [fase, setFase] = useState<Fase>('idle');
  const [pausado, setPausado] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [total, setTotal] = useState(0);
  const [momentos, setMomentos] = useState<number[]>([]);
  const [aoVivo, setAoVivo] = useState(false);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [parcial, setParcial] = useState('');
  const [salvos, setSalvos] = useState(0);
  const [etapaFinal, setEtapaFinal] = useState('Finalizando…');
  const painelRef = useRef<HTMLDivElement | null>(null);

  const est = useRef<Estado>({
    wsTentativas: 0,
    ext: 'webm',
    mime: '',
    index: 0,
    cadeia: Promise.resolve(),
    fila: [],
    flushing: Promise.resolve(),
    acumuladoMs: 0,
    inicioSegmento: 0,
  });

  // Para tudo ao sair da tela (não deixa microfone nem socket abertos).
  useEffect(() => {
    return () => {
      const e = est.current;
      if (e.timer) clearInterval(e.timer);
      if (e.flushTimer) clearInterval(e.flushTimer);
      if (e.keepAlive) clearInterval(e.keepAlive);
      for (const r of [e.rec, e.recLive]) {
        try {
          if (r && r.state !== 'inactive') r.stop();
        } catch {
          // ignora
        }
      }
      try {
        e.ws?.close();
      } catch {
        // ignora
      }
      e.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Rola o painel da transcrição para o fim a cada trecho novo.
  useEffect(() => {
    const el = painelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [trechos, parcial]);

  /** Posição atual da gravação em ms (congela quando pausada). */
  function posMs(): number {
    const e = est.current;
    const rodando = e.rec?.state === 'recording';
    return e.acumuladoMs + (rodando ? Date.now() - e.inicioSegmento : 0);
  }

  // ───────────────────────── upload dos blocos (arquivo) ─────────────────────────

  async function subirBloco(
    supabase: SupabaseClient,
    org: string,
    recId: string,
    index: number,
    blob: Blob,
    ext: string,
  ) {
    const path = `${org}/${recId}/${String(index).padStart(4, '0')}.${ext}`;
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

  // ───────────────────── transcrição ao vivo (Deepgram Live) ─────────────────────

  /** Envia os trechos finais pendentes em lote; em falha, devolve à fila (nunca perde). */
  function flush(): Promise<void> {
    const e = est.current;
    e.flushing = e.flushing.then(async () => {
      if (!e.fila.length || !e.recordingId) return;
      const lote = e.fila.splice(0, 200);
      try {
        const res = await fetch('/api/live/segmentos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recordingId: e.recordingId, segments: lote }),
        });
        if (!res.ok) throw new Error('persistência falhou');
        setSalvos((n) => n + lote.length);
      } catch {
        e.fila.unshift(...lote); // tenta de novo no próximo ciclo
      }
    });
    return e.flushing;
  }

  function tratarMensagem(ev: MessageEvent) {
    let msg: ResultadoDG;
    try {
      msg = JSON.parse(String(ev.data)) as ResultadoDG;
    } catch {
      return;
    }
    if (msg.type !== 'Results') return;
    const alt = msg.channel?.alternatives?.[0];
    const texto = alt?.transcript?.trim();
    if (!texto) return;
    if (!msg.is_final) {
      setParcial(texto);
      return;
    }
    const novos = alt?.words?.length
      ? agruparPorFalante(alt.words)
      : [
          {
            speaker: 0,
            startMs: Math.round((msg.start ?? 0) * 1000),
            endMs: Math.round(((msg.start ?? 0) + (msg.duration ?? 0)) * 1000),
            text: texto,
          },
        ];
    setParcial('');
    setTrechos((t) => [...t, ...novos]);
    est.current.fila.push(...novos);
  }

  /** Abre (ou reabre) o socket do Deepgram com uma chave temporária. */
  async function conectarLive(): Promise<boolean> {
    const e = est.current;
    try {
      const res = await fetch('/api/deepgram/token', { method: 'POST' });
      if (!res.ok) return false;
      const { key } = (await res.json()) as { key?: string };
      if (!key) return false;
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${LIVE_PARAMS}`, ['token', key]);
      e.ws = ws;
      ws.onmessage = tratarMensagem;
      ws.onerror = () => {
        /* onclose cuida da reconexão */
      };
      ws.onclose = (ev) => {
        if (e.ws !== ws) return; // socket antigo
        e.ws = undefined;
        if (ev.code === 1000) return; // fechamos de propósito
        // Reconecta até 3x enquanto estiver gravando; o áudio dos blocos segue salvo.
        if (e.rec && e.rec.state !== 'inactive' && e.wsTentativas < 3) {
          e.wsTentativas += 1;
          setTimeout(() => void conectarLive(), 1000 * e.wsTentativas);
        } else {
          setAoVivo(false);
          setAviso('A transcrição ao vivo caiu; o que já foi transcrito está salvo.');
        }
      };
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        const t = setTimeout(() => reject(new Error('timeout')), 8000);
        ws.addEventListener('open', () => clearTimeout(t), { once: true });
      });
      e.wsTentativas = 0;
      setAoVivo(true);
      setAviso(null);
      return true;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────── controles ─────────────────────────────────

  async function iniciar() {
    setErro(null);
    setAviso(null);
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
      e.mime = mime;
      e.index = 0;
      e.cadeia = Promise.resolve();
      e.fila = [];
      e.flushing = Promise.resolve();
      e.wsTentativas = 0;
      e.acumuladoMs = 0;
      e.inicioSegmento = Date.now();
      setEnviados(0);
      setTotal(0);
      setSegundos(0);
      setMomentos([]);
      setTrechos([]);
      setParcial('');
      setSalvos(0);
      setPausado(false);

      // Transcrição ao vivo (se o provedor estiver configurado); sem ela, segue
      // gravando e processa ao parar pelo caminho antigo.
      const live = await conectarLive();
      if (!live) setAviso('Transcrição ao vivo indisponível — a ata será gerada ao parar.');

      // Gravador 1: blocos de 20s para o arquivo/player.
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      e.rec = mr;
      mr.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        const idx = e.index++;
        const blob = ev.data;
        setTotal((n) => n + 1);
        e.cadeia = e.cadeia.then(() => subirBloco(supabase, org, rec.id, idx, blob, ext));
      };
      mr.start(20000);

      // Gravador 2: blocos de 250ms direto para o socket do Deepgram.
      if (live) {
        const ml = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        e.recLive = ml;
        ml.ondataavailable = (ev: BlobEvent) => {
          const ws = e.ws;
          if (ev.data?.size && ws && ws.readyState === WebSocket.OPEN) ws.send(ev.data);
        };
        ml.start(250);
        e.flushTimer = setInterval(() => void flush(), 4000);
      }

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
      e.recLive?.pause();
    } catch {
      // ignora
    }
    // Deepgram fecha sockets ociosos; mantém vivo enquanto pausado.
    e.keepAlive = setInterval(() => {
      if (e.ws?.readyState === WebSocket.OPEN) e.ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }, 5000);
    setPausado(true);
  }

  function retomar() {
    const e = est.current;
    if (!e.rec || e.rec.state !== 'paused') return;
    e.inicioSegmento = Date.now();
    if (e.keepAlive) clearInterval(e.keepAlive);
    e.keepAlive = undefined;
    try {
      e.rec.resume();
      e.recLive?.resume();
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
    setEtapaFinal('Encerrando a gravação…');
    if (e.timer) clearInterval(e.timer);
    if (e.flushTimer) clearInterval(e.flushTimer);
    if (e.keepAlive) clearInterval(e.keepAlive);

    // Fecha o socket de forma limpa (o servidor entrega os últimos finais) e os gravadores.
    try {
      if (e.ws?.readyState === WebSocket.OPEN) e.ws.send(JSON.stringify({ type: 'CloseStream' }));
    } catch {
      // ignora
    }
    try {
      if (e.recLive && e.recLive.state !== 'inactive') e.recLive.stop();
    } catch {
      // ignora
    }
    await new Promise<void>((resolve) => {
      e.rec!.onstop = () => resolve();
      try {
        e.rec!.stop();
      } catch {
        resolve();
      }
    });
    e.stream?.getTracks().forEach((t) => t.stop());
    // Dá um instante para os últimos resultados finais chegarem antes de fechar.
    await new Promise((r) => setTimeout(r, 1500));
    const wsAberto = e.ws;
    e.ws = undefined;
    try {
      wsAberto?.close(1000);
    } catch {
      // ignora
    }

    setEtapaFinal('Enviando os últimos blocos…');
    try {
      await e.cadeia;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'um bloco não subiu; a gravação foi salva.');
    }
    await flush();

    const supabase = createClient();
    const temTranscricaoAoVivo = trechos.length + e.fila.length > 0 || salvos > 0;
    try {
      if (momentos.length) {
        await supabase
          .from('recordings')
          .update({ highlights: momentos.map((atMs) => ({ atMs })) })
          .eq('id', e.recordingId);
      }
      if (temTranscricaoAoVivo) {
        // Transcrição já está no banco: gera a ata agora (segundos), sem áudio/ffmpeg.
        setEtapaFinal('Gerando a ata…');
        await fetch('/api/ata/gerar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recordingId: e.recordingId }),
        });
      } else {
        // Sem transcrição ao vivo: caminho antigo (processa o áudio ao parar).
        setEtapaFinal('Processando o áudio…');
        await fetch('/api/process', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recordingId: e.recordingId }),
        });
      }
    } catch {
      // A gravação já está salva; o processamento pode ser retomado na tela dela.
    }
    router.push(`/gravacao/${e.recordingId}`);
    router.refresh();
  }

  // ─────────────────────────────────── UI ───────────────────────────────────

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 16 }}>
        <Rotulo>Gravar</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Gravar reunião</h1>
      </header>

      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
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
              será gravada. A transcrição aparece aqui em tempo real.
            </p>
          </>
        )}

        {fase === 'gravando' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={pausado ? 'rec-dot-paused' : 'rec-dot'} />
              <Rotulo>{pausado ? 'Pausado' : aoVivo ? 'Gravando · ao vivo' : 'Gravando'}</Rotulo>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 600 }}>
              {mmss(segundos)}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {enviados}/{total} blocos · {salvos} trechos salvos
              {momentos.length > 0 && ` · ${momentos.length} momento(s)`}
            </span>

            {/* Transcrição ao vivo */}
            <div
              ref={painelRef}
              aria-live="polite"
              style={{
                width: '100%',
                maxHeight: 280,
                overflowY: 'auto',
                padding: '12px 14px',
                borderRadius: 'var(--radius-menu)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: 14,
                lineHeight: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {trechos.length === 0 && !parcial && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {aoVivo ? 'Ouvindo… fale normalmente.' : 'Transcrição ao vivo indisponível.'}
                </span>
              )}
              {trechos.map((t, i) => (
                <p key={i} style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Falante {t.speaker + 1}:
                  </strong>{' '}
                  {t.text}
                </p>
              ))}
              {parcial && (
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {parcial}
                </p>
              )}
            </div>

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
              Parar e gerar ata
            </button>
          </>
        )}

        {fase === 'finalizando' && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <div
              className="sk"
              style={{ height: 6, width: 160, borderRadius: 3, margin: '0 auto 14px' }}
            />
            <p style={{ color: 'var(--text)', fontSize: 15, margin: 0 }}>{etapaFinal}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '6px 0 0' }}>
              A transcrição já está salva; a ata leva poucos segundos.
            </p>
          </div>
        )}

        {aviso && !erro && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
            {aviso}
          </span>
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
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 700,
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
