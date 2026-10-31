'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Menu "⋯" da gravação. Hoje só tem "Excluir gravação", sempre com confirmação.
 * A exclusão é lógica (`deleted_at`, SPEC 24): a RLS só deixa o dono ou um
 * admin da empresa; biblioteca, busca e links já ignoram gravações excluídas.
 */
export function MenuGravacao({ recordingId, titulo }: { recordingId: string; titulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const idMenu = useId();
  const idDialogo = useId();
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

  useEffect(() => {
    if (!confirmando) return;
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !excluindo) setConfirmando(false);
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [confirmando, excluindo]);

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
        <div className="confirmacao-fundo" onClick={() => !excluindo && setConfirmando(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${idDialogo}-t`}
            aria-describedby={`${idDialogo}-d`}
            className="confirmacao"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id={`${idDialogo}-t`} style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
              Excluir esta gravação?
            </h2>
            <p
              id={`${idDialogo}-d`}
              style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}
            >
              <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{titulo}</strong> deixa de
              aparecer para todos da empresa, com o áudio, a transcrição e a ata. Links
              compartilhados param de funcionar.
            </p>
            {erro && (
              <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
                {erro}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="confirmacao-cancelar"
                onClick={() => setConfirmando(false)}
                disabled={excluindo}
                autoFocus
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirmacao-excluir"
                onClick={excluir}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Excluir gravação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
