'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card, Rotulo } from '@talkin/ui';

export default function ImportarPage() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const configurado = isSupabaseConfigured();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!arquivo) return;
    const supabase = createClient();

    try {
      setEtapa('Identificando empresa…');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('sessão expirada');
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const org = membership?.organization_id;
      if (!org) throw new Error('empresa não encontrada');

      setEtapa('Criando gravação…');
      const { data: rec, error: recErr } = await supabase
        .from('recordings')
        .insert({
          organization_id: org,
          created_by: user.id,
          title: titulo || arquivo.name,
          source: 'importado',
        })
        .select('id')
        .single();
      if (recErr || !rec) throw new Error(recErr?.message ?? 'falha ao criar gravação');

      setEtapa('Enviando áudio…');
      const ext = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'bin';
      const path = `${org}/${rec.id}/000.${ext}`;
      const { error: upErr } = await supabase.storage.from('audio').upload(path, arquivo);
      if (upErr) throw new Error(upErr.message);

      await supabase.from('recording_chunks').insert({
        recording_id: rec.id,
        index: 0,
        storage_path: path,
        bytes: arquivo.size,
        uploaded_at: new Date().toISOString(),
      });

      setEtapa('Processando (transcrição e ata)…');
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordingId: rec.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // A gravação foi criada; o processamento pode ser retomado na tela dela.
        setErro(body.error ?? 'Falha ao iniciar o processamento. A gravação foi salva.');
      }

      router.push(`/gravacao/${rec.id}`);
      router.refresh();
    } catch (err) {
      setEtapa(null);
      setErro(err instanceof Error ? err.message : 'falha no envio');
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Importar</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>
          Importar áudio ou vídeo
        </h1>
      </header>
      <Card>
        {!configurado && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Conecte o Supabase para importar de verdade. Formatos: mp3, m4a, wav, aac, ogg/opus,
            webm, mp4, mov.
          </p>
        )}
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="text"
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={campo}
          />
          <input
            type="file"
            accept="audio/*,video/*,.m4a,.opus,.webm"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            style={{ color: 'var(--text-secondary)', fontSize: 13 }}
          />
          {erro && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }} role="alert">
              {erro}
            </span>
          )}
          {etapa && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{etapa}</span>}
          <button type="submit" disabled={!configurado || !arquivo || etapa !== null} style={botao}>
            Importar
          </button>
        </form>
      </Card>
    </div>
  );
}

const campo: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
};

const botao: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
