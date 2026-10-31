'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateBR } from '@talkin/core';
import { Card, Pilula } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { DIAS_LIXEIRA } from '@/lib/expurgo';

export type ItemLixeira = { id: string; title: string; deleted_at: string; created_at: string };

function diasRestantes(deletedAt: string): number {
  const expira = new Date(deletedAt).getTime() + DIAS_LIXEIRA * 86_400_000;
  return Math.max(0, Math.ceil((expira - Date.now()) / 86_400_000));
}

/** Lista da lixeira: restaurar (volta para a biblioteca) ou excluir de vez, com confirmação. */
export function Lixeira({ itens: iniciais }: { itens: ItemLixeira[] }) {
  const [itens, setItens] = useState(iniciais);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<ItemLixeira | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function restaurar(item: ItemLixeira) {
    setOcupado(item.id);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recordings')
      .update({ deleted_at: null })
      .eq('id', item.id)
      .select('id')
      .maybeSingle();
    setOcupado(null);
    if (error || !data) {
      setErro('Não foi possível restaurar. Só quem gravou ou um admin pode restaurar.');
      return;
    }
    setItens((l) => l.filter((i) => i.id !== item.id));
    router.refresh();
  }

  async function excluirDeVez(item: ItemLixeira) {
    setOcupado(item.id);
    setErro(null);
    const res = await fetch(`/api/gravacoes/${item.id}/expurgar`, { method: 'POST' });
    setOcupado(null);
    if (!res.ok) {
      setErro('Não foi possível excluir agora. Tente de novo em instantes.');
      return;
    }
    setConfirmar(null);
    setItens((l) => l.filter((i) => i.id !== item.id));
  }

  if (itens.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 28 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>A lixeira está vazia.</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Gravações excluídas ficam aqui por {DIAS_LIXEIRA} dias antes de serem apagadas de vez.
        </p>
        <Link
          href="/biblioteca"
          style={{ display: 'inline-block', marginTop: 14, fontSize: 13, color: 'var(--accent)' }}
        >
          Voltar para a biblioteca
        </Link>
      </Card>
    );
  }

  return (
    <>
      {erro && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>
          {erro}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {itens.map((g) => {
          const dias = diasRestantes(g.deleted_at);
          return (
            <li key={g.id}>
              <Card
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '14px 16px',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {g.title?.trim() || 'Sem título'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Gravada em {formatDateBR(g.created_at)} · excluída em{' '}
                    {formatDateBR(g.deleted_at)}
                  </div>
                </div>
                <Pilula>
                  {dias === 0 ? 'Apaga hoje' : `Apaga em ${dias} dia${dias === 1 ? '' : 's'}`}
                </Pilula>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="lixeira-restaurar"
                    onClick={() => restaurar(g)}
                    disabled={ocupado === g.id}
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="lixeira-excluir"
                    onClick={() => setConfirmar(g)}
                    disabled={ocupado === g.id}
                  >
                    Excluir de vez
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {confirmar && (
        <div className="confirmacao-fundo" onClick={() => !ocupado && setConfirmar(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lixeira-conf-t"
            aria-describedby="lixeira-conf-d"
            className="confirmacao"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="lixeira-conf-t" style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
              Excluir de vez?
            </h2>
            <p
              id="lixeira-conf-d"
              style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}
            >
              <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
                {confirmar.title?.trim() || 'Sem título'}
              </strong>{' '}
              será apagada agora, com o áudio, a transcrição e a ata. Isso não pode ser desfeito.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="confirmacao-cancelar"
                onClick={() => setConfirmar(null)}
                disabled={Boolean(ocupado)}
                autoFocus
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirmacao-excluir"
                onClick={() => excluirDeVez(confirmar)}
                disabled={Boolean(ocupado)}
              >
                {ocupado ? 'Excluindo…' : 'Excluir de vez'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
