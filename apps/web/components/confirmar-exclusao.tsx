'use client';

import { useEffect, useId } from 'react';

/**
 * Diálogo de confirmação de exclusão, no centro da tela. É o único caminho para
 * excluir uma gravação (menu ⋯ e arrastar na lista); nunca exclui sem passar aqui.
 */
export function ConfirmarExclusao({
  titulo,
  excluindo,
  erro,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  excluindo: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const id = useId();

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !excluindo) onCancelar();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [excluindo, onCancelar]);

  return (
    <div className="confirmacao-fundo" onClick={() => !excluindo && onCancelar()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        className="confirmacao"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={`${id}-t`} style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
          Excluir esta gravação?
        </h2>
        <p
          id={`${id}-d`}
          style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}
        >
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
            {titulo.trim() || 'Sem título'}
          </strong>{' '}
          vai para a lixeira e some para todos da empresa, com o áudio, a transcrição e a ata. Links
          compartilhados param de funcionar. Dá para restaurar em até 30 dias.
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
            onClick={onCancelar}
            disabled={excluindo}
            autoFocus
          >
            Cancelar
          </button>
          <button
            type="button"
            className="confirmacao-excluir"
            onClick={onConfirmar}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo…' : 'Excluir gravação'}
          </button>
        </div>
      </div>
    </div>
  );
}
