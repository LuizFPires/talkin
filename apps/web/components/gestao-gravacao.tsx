'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Rotulo, Pilula } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';

type Pessoa = { id: string; name: string };
type Falante = { id: string; label: string; display_name: string | null; person_id: string | null };
type Pendencia = { id: string; text: string; assignee_person_id: string | null };

const sel: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 12,
};

/** M6: renomear/ligar falantes e atribuir pendências a pessoas cadastradas. */
export function GestaoGravacao({ recordingId }: { recordingId: string }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [falantes, setFalantes] = useState<Falante[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [summary, setSummary] = useState<{ id: string; status: string } | null>(null);
  const [temWebhook, setTemWebhook] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function carregar() {
    const supabase = createClient();
    const [pp, sp, ai, sm] = await Promise.all([
      supabase.from('people').select('id, name').is('deleted_at', null).order('name'),
      supabase
        .from('speakers')
        .select('id, label, display_name, person_id')
        .eq('recording_id', recordingId)
        .order('label'),
      supabase
        .from('action_items')
        .select('id, text, assignee_person_id')
        .eq('recording_id', recordingId),
      supabase
        .from('summaries')
        .select('id, status')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPessoas((pp.data as Pessoa[] | null) ?? []);
    setFalantes((sp.data as Falante[] | null) ?? []);
    setPendencias((ai.data as Pendencia[] | null) ?? []);
    setSummary((sm.data as { id: string; status: string } | null) ?? null);
    const { data: integ } = await supabase
      .from('integrations')
      .select('ioo_webhook_url')
      .maybeSingle();
    setTemWebhook(Boolean((integ as { ioo_webhook_url: string | null } | null)?.ioo_webhook_url));
  }

  async function marcarRevisada() {
    if (!summary) return;
    const { data, error } = await createClient()
      .from('summaries')
      .update({ status: 'revisada' })
      .eq('id', summary.id)
      .select('id');
    if (error || !data?.length) {
      setMsg('Sem permissão para revisar.');
      return;
    }
    setSummary({ ...summary, status: 'revisada' });
    setMsg('Ata marcada como revisada.');
  }

  async function enviarIoo() {
    const res = await fetch('/api/integracoes/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordingId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? 'Enviado ao ioo.' : (body.error ?? 'Falha ao enviar.'));
  }

  useEffect(() => {
    void carregar();
  }, [recordingId]);

  async function salvarFalante(f: Falante) {
    const supabase = createClient();
    // Renomear propaga para toda a gravação (os trechos referenciam o falante por id).
    // .select() detecta 0 linhas (RLS bloqueou) → evita falso sucesso.
    const { data, error } = await supabase
      .from('speakers')
      .update({ display_name: f.display_name, person_id: f.person_id })
      .eq('id', f.id)
      .select('id');
    if (error || !data?.length) {
      setMsg('Sem permissão para editar este falante.');
      return;
    }
    setMsg('Falante salvo.');
    router.refresh(); // reflete o novo nome na transcrição
  }

  async function atribuir(p: Pendencia, personId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('action_items')
      .update({ assignee_person_id: personId || null })
      .eq('id', p.id)
      .select('id');
    if (error || !data?.length) {
      setMsg('Sem permissão para atribuir esta pendência.');
      return;
    }
    setMsg('Pendência atribuída.');
    setPendencias((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, assignee_person_id: personId || null } : x)),
    );
  }

  if (falantes.length === 0 && pendencias.length === 0 && !summary) return null;

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}

      {summary && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Rotulo>Ata</Rotulo>
          <Pilula>{summary.status === 'revisada' ? 'Revisada' : 'Rascunho'}</Pilula>
          {summary.status !== 'revisada' && (
            <button
              type="button"
              onClick={() => void marcarRevisada()}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--accent)',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Marcar como revisada
            </button>
          )}
          {summary.status === 'revisada' && temWebhook && (
            <button
              type="button"
              onClick={() => void enviarIoo()}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Enviar ao ioo
            </button>
          )}
        </Card>
      )}

      {falantes.length > 0 && (
        <Card>
          <Rotulo>Falantes</Rotulo>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {falantes.map((f) => (
              <div
                key={f.id}
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Pilula>{f.label}</Pilula>
                <input
                  placeholder="Nome na gravação"
                  value={f.display_name ?? ''}
                  onChange={(e) =>
                    setFalantes((fs) =>
                      fs.map((x) => (x.id === f.id ? { ...x, display_name: e.target.value } : x)),
                    )
                  }
                  style={{ ...sel, flex: 1, minWidth: 140 }}
                />
                <select
                  value={f.person_id ?? ''}
                  onChange={(e) =>
                    setFalantes((fs) =>
                      fs.map((x) =>
                        x.id === f.id ? { ...x, person_id: e.target.value || null } : x,
                      ),
                    )
                  }
                  style={sel}
                >
                  <option value="">— pessoa —</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void salvarFalante(f)}
                  style={{ ...sel, cursor: 'pointer' }}
                >
                  Salvar
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pendencias.length > 0 && (
        <Card>
          <Rotulo>Pendências — responsável</Rotulo>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {pendencias.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13 }}>{p.text}</span>
                <select
                  value={p.assignee_person_id ?? ''}
                  onChange={(e) => void atribuir(p, e.target.value)}
                  style={sel}
                >
                  <option value="">— sem responsável —</option>
                  {pessoas.map((pe) => (
                    <option key={pe.id} value={pe.id}>
                      {pe.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
