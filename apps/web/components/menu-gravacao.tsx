'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmarExclusao } from '@/components/confirmar-exclusao';
import { createClient } from '@/lib/supabase/client';

export type AcaoMenu = { label: string; descricao?: string; onClick: () => void };

/**
 * Menu "⋯" da gravação: ações da tela (renomear, modelo, regenerar…) e, por
 * último, "Excluir gravação", sempre com confirmação no centro da tela.
 * A exclusão é lógica (`deleted_at`, SPEC 24): a RLS só deixa o dono ou um
 * admin da empresa; biblioteca, busca e links já ignoram gravações excluídas.
 */
export function MenuGravacao({
  recordingId,
  titulo,
  acoes = [],
}: {
  recordingId: string;
  titulo: string;
  acoes?: AcaoMenu[];
}) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const idMenu = useId();
  const router = useRouter();

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node)) setAberto(false);
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recordings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', recordingId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      setExcluindo(false);
      setErro(
        error
          ? 'Não foi possível excluir. Só quem gravou ou um admin da empresa pode excluir.'
          : 'Esta gravação já foi excluída.',
      );
      return;
    }
    router.push('/biblioteca');
    router.refresh();
  }

  return (
    <div ref={raiz} style={{ position: 'relative' }}>
      <button
        type="button"
        className="menu-gravacao-botao"
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {aberto && (
        <div id={idMenu} role="menu" className="menu-gravacao">
          {acoes.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className="menu-gravacao-item"
              onClick={() => {
                setAberto(false);
                a.onClick();
              }}
            >
              {a.label}
              {a.descricao && <small>{a.descricao}</small>}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="menu-gravacao-item perigo"
            onClick={() => {
              setAberto(false);
              setErro(null);
              setConfirmando(true);
            }}
          >
            Excluir gravação
          </button>
        </div>
      )}

      {confirmando && (
        <ConfirmarExclusao
          titulo={titulo}
          excluindo={excluindo}
          erro={erro}
          onCancelar={() => !excluindo && setConfirmando(false)}
          onConfirmar={() => void excluir()}
        />
      )}
    </div>
  );
}
