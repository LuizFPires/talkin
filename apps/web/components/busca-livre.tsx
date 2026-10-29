'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  interpretarBusca,
  formatMinute,
  type BuscaInterpretada,
  type Cadastro,
} from '@talkin/core';
import { Card, Pilula, Rotulo, SearchField, ToggleSegmentado } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';

type Grupo = {
  recordingId: string;
  title: string;
  source: string;
  date: string;
  trechos: { startMs: number; text: string }[];
};

export function BuscaLivre() {
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'significado' | 'exata'>('significado');
  const [cadastro, setCadastro] = useState<Cadastro>({ obras: [], participantes: [], tipos: [] });
  const [interp, setInterp] = useState<BuscaInterpretada | null>(null);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [obras, tipos, speakers] = await Promise.all([
        supabase.from('projects').select('id, name').is('deleted_at', null),
        supabase.from('templates').select('key, name'),
        supabase.from('speakers').select('display_name').not('display_name', 'is', null).limit(200),
      ]);
      const participantes = [
        ...new Set(
          ((speakers.data as { display_name: string }[] | null) ?? []).map((s) => s.display_name),
        ),
      ].map((name, i) => ({ id: `sp${i}`, name }));
      setCadastro({
        obras: (obras.data as { id: string; name: string }[] | null) ?? [],
        tipos: (tipos.data as { key: string; name: string }[] | null) ?? [],
        participantes,
      });
    })();
  }, []);

  async function buscar() {
    const r = interpretarBusca(texto, cadastro);
    setInterp(r);
    setRemovidos(new Set());
    await executar(r, new Set());
  }

  async function executar(r: BuscaInterpretada, rem: Set<string>) {
    setBuscando(true);
    const filtros = {
      obraId: rem.has('obra') ? null : (r.filtros.obra?.id ?? null),
      participante: rem.has('participante') ? null : (r.filtros.participante?.name ?? null),
      plataforma: rem.has('plataforma') ? null : (r.filtros.plataforma ?? null),
      tipoKey: rem.has('tipo') ? null : (r.filtros.tipo?.key ?? null),
      periodo: rem.has('periodo') ? null : (r.filtros.periodo ?? null),
    };
    const tema = rem.has('tema') ? '' : r.tema;
    const res = await fetch('/api/buscar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tema, modo, filtros }),
    });
    const body = (await res.json().catch(() => ({ grupos: [] }))) as { grupos?: Grupo[] };
    setGrupos(body.grupos ?? []);
    setBuscando(false);
  }

  function removerChip(tipo: string) {
    if (!interp) return;
    const rem = new Set(removidos);
    rem.add(tipo);
    setRemovidos(rem);
    void executar(interp, rem);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchField
          value={texto}
          onChange={setTexto}
          placeholder="Buscar: concreto Galpão A com Marcos em outubro…"
        />
        <button
          type="button"
          onClick={() => void buscar()}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Buscar
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <ToggleSegmentado
          value={modo}
          onChange={(v) => setModo(v as 'significado' | 'exata')}
          options={[
            { value: 'significado', label: 'Por significado' },
            { value: 'exata', label: 'Palavra exata' },
          ]}
        />
      </div>

      {interp && interp.chips.some((c) => !removidos.has(c.tipo)) && (
        <div style={{ marginTop: 12 }}>
          <Rotulo>Entendi assim</Rotulo>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {interp.chips
              .filter((c) => !removidos.has(c.tipo))
              .map((c) => (
                <button
                  key={c.tipo}
                  type="button"
                  onClick={() => removerChip(c.tipo)}
                  title="Remover filtro"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <Pilula>
                    {c.tipo}: {c.label} ✕
                  </Pilula>
                </button>
              ))}
          </div>
        </div>
      )}

      {buscando && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 12 }}>Buscando…</p>
      )}

      {grupos && !buscando && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {grupos.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Nenhuma reunião encontrada.
            </p>
          )}
          {grupos.map((g) => (
            <Link
              key={g.recordingId}
              href={`/gravacao/${g.recordingId}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{g.title?.trim() || 'Sem título'}</span>
                  {g.trechos.length > 0 && <Pilula>{g.trechos.length} menção(ões)</Pilula>}
                </div>
                {g.trechos.map((t, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'baseline' }}
                  >
                    <Pilula mono>{formatMinute(t.startMs)}</Pilula>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.text}</span>
                  </div>
                ))}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
