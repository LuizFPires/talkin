import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Chunk, UploadQueue } from '@talkin/capture';
import { createUploadQueue } from './capture-client';
import { isConfigured, supabase } from './supabase';

type ChunkEvent = {
  index: number;
  track: 'eu' | 'outros';
  path: string;
  durationMs: number;
  bytes: number;
};
type Meeting = { app: string; title: string } | null;

let queue: UploadQueue | null = null;
let recordingId: string | null = null;
let recording = false;

const app = document.getElementById('app')!;

/** Escapa texto não confiável (título/app vêm da detecção de janela do SO). */
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function render(status: string, meeting: Meeting) {
  app.innerHTML = `
    <main style="padding:20px;width:320px">
      <div style="text-transform:uppercase;font-size:11px;letter-spacing:.18em;color:#798e91">Talkin</div>
      <h1 style="font-size:18px;margin:6px 0 14px">Gravar reunião</h1>
      ${
        meeting
          ? `<div style="background:#060606;border:1px solid #2b2b2b;border-radius:16px;padding:12px;margin-bottom:12px">
               <div style="font-size:13px;color:#98989d">Reunião detectada</div>
               <div style="font-size:14px">${esc(meeting.app)} — ${esc(meeting.title)}</div>
             </div>`
          : ''
      }
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="width:9px;height:9px;border-radius:50%;background:${recording ? '#ff7a7a' : '#2b2b2b'}"></span>
        <span style="font-size:13px;color:#98989d">${esc(status)}</span>
      </div>
      <button id="toggle" style="width:100%;padding:12px;border-radius:9999px;border:1px solid #94efda;background:${recording ? 'transparent' : '#94efda'};color:${recording ? '#f5f5f7' : '#04221a'};font-weight:600;cursor:pointer">
        ${recording ? 'Parar' : 'Gravar esta reunião'}
      </button>
      <p style="font-size:11px;color:#798e91;margin-top:10px">Faixas separadas: você (microfone) × outros (áudio do sistema). Avise os participantes.</p>
    </main>`;
  document.getElementById('toggle')?.addEventListener('click', () => void toggle());
}

async function toggle() {
  if (recording) return stop();
  return start();
}

async function start() {
  if (!isConfigured()) {
    render('Conecte o Supabase (VITE_SUPABASE_URL/ANON_KEY).', null);
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    render('Entre na sua conta para gravar.', null);
    return;
  }
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const org = membership?.organization_id as string | undefined;
  if (!org) {
    render('Empresa não encontrada.', null);
    return;
  }
  const { data: rec, error: recErr } = await supabase
    .from('recordings')
    .insert({ organization_id: org, created_by: user.id, source: 'meet', title: '' })
    .select('id')
    .single();
  if (recErr || !rec) {
    render(`Não foi possível criar a gravação: ${recErr?.message ?? 'erro'}`, null);
    return;
  }

  recordingId = rec.id;
  queue = createUploadQueue(org, rec.id);
  await queue.init();
  await invoke('start_capture', { recordingId: rec.id });
  recording = true;
  render('Gravando — avise os participantes', null);
}

async function stop() {
  recording = false;
  await invoke('stop_capture');
  const r = await queue?.flush();
  render(
    r && r.pending > 0 ? `${r.pending} bloco(s) pendentes (reenviam ao reabrir)` : 'Pronto',
    null,
  );
  queue = null;
  recordingId = null;
}

// Atalho global (⌘⇧R / Ctrl+Shift+R) iniciar/parar.
void listen('shortcut-toggle', () => void toggle());

// Blocos emitidos pelo módulo nativo (duas faixas) → fila de upload.
void listen<ChunkEvent>('chunk', async (e) => {
  if (!queue) return;
  const chunk: Chunk = {
    index: e.payload.index,
    localPath: e.payload.path,
    durationMs: e.payload.durationMs,
    bytes: e.payload.bytes,
    track: e.payload.track,
  };
  await queue.add(chunk);
  void queue.flush();
});

// Detecção de reunião (SPEC 3): sugere gravar, nunca grava sozinho.
async function pollMeeting() {
  if (recording || !isConfigured()) return;
  try {
    const meeting = await invoke<Meeting>('detect_meeting');
    render('Pronto para gravar', meeting);
  } catch {
    render('Pronto para gravar', null);
  }
}

render('Pronto para gravar', null);
setInterval(() => void pollMeeting(), 5000);
