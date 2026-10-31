'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDateBR, type RecordingSource, type RecordingStatus } from '@talkin/core';
import { Pilula } from '@talkin/ui';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmarExclusao } from '@/components/confirmar-exclusao';
import { createClient } from '@/lib/supabase/client';

export type LinhaGravacao = {
  id: string;
  title: string;
  status: RecordingStatus;
  source: RecordingSource;
  duration_s: number | null;
  created_at: string;
};

const ORIGEM: Record<RecordingSource, string> = {
  presencial: 'Presencial',
  meet: 'Meet',
  teams: 'Teams',
  zoom: 'Zoom',
  whatsapp: 'WhatsApp',
  importado: 'Importado',
  outro: 'Outro',
};

/** Largura da ação revelada ao arrastar para a esquerda. */
const ABERTO = 96;

/**
 * Lista de reuniões. Arrastar uma linha para a esquerda revela "Excluir"; a
 * exclusão só acontece depois da confirmação (diálogo central). Também há um
 * botão de excluir acessível por teclado/mouse (aparece ao focar ou passar o mouse).
 */
export function ListaGravacoes({ itens: iniciais }: { itens: LinhaGravacao[] }) {
  const [itens, setItens] = useState(iniciais);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<LinhaGravacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function excluir() {
    if (!confirmar) return;
    setExcluindo(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recordings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', confirmar.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    setExcluindo(false);
    if (error || !data) {
      setErro(
        error
          ? 'Não foi possível excluir. Só quem gravou ou um admin da empresa pode excluir.'
          : 'Esta gravação já foi excluída.',
      );
      return;
    }
    const id = confirmar.id;
    setConfirmar(null);
    setAbertoId(null);
    setItens((l) => l.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {itens.map((g) => (
          <Linha
            key={g.id}
            item={g}
            aberto={abertoId === g.id}
            onAbrir={(v) => setAbertoId(v ? g.id : null)}
            onExcluir={() => {
              setErro(null);
              setConfirmar(g);
            }}
          />
        ))}
      </ul>
      {confirmar && (
        <ConfirmarExclusao
          titulo={confirmar.title}
          excluindo={excluindo}
          erro={erro}
          onCancelar={() => !excluindo && setConfirmar(null)}
          onConfirmar={() => void excluir()}
        />
      )}
    </>
  );
}

function Linha({
  item: g,
  aberto,
  onAbrir,
  onExcluir,
}: {
  item: LinhaGravacao;
  aberto: boolean;
  onAbrir: (aberto: boolean) => void;
  onExcluir: () => void;
}) {
  const [dx, setDx] = useState(0); // deslocamento durante o arrasto (0 quando parado)
  const [arrastando, setArrastando] = useState(false);
  const gesto = useRef<{ x0: number; y0: number; id: number; horizontal: boolean | null } | null>(
    null,
  );
  const moveu = useRef(false);
  const dxRef = useRef(0); // valor atual sem depender do re-render (gesto rápido)

  const base = aberto ? -ABERTO : 0;
  const x = arrastando ? Math.max(-ABERTO - 24, Math.min(0, base + dx)) : base;

  function inicio(ev: React.PointerEvent) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    gesto.current = { x0: ev.clientX, y0: ev.clientY, id: ev.pointerId, horizontal: null };
    moveu.current = false;
    dxRef.current = 0;
    setDx(0);
  }

  function mover(ev: React.PointerEvent) {
    const gs = gesto.current;
    if (!gs || gs.id !== ev.pointerId) return;
    const ddx = ev.clientX - gs.x0;
    const ddy = ev.clientY - gs.y0;
    if (gs.horizontal === null) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
      gs.horizontal = Math.abs(ddx) > Math.abs(ddy);
      if (!gs.horizontal) {
        gesto.current = null; // rolagem vertical: não interfere
        return;
      }
      setArrastando(true);
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    }
    moveu.current = true;
    dxRef.current = ddx;
    setDx(ddx);
  }

  function fim(ev: React.PointerEvent) {
    const gs = gesto.current;
    if (!gs || gs.id !== ev.pointerId) return;
    gesto.current = null;
    if (gs.horizontal === null) {
      // Sem evento de movimento (gesto muito rápido): decide pela posição final.
      const ddx = ev.clientX - gs.x0;
      if (Math.abs(ddx) < 30) return; // toque simples: o clique navega
      moveu.current = true;
      dxRef.current = ddx;
    } else if (!gs.horizontal) return;
    setArrastando(false);
    const final = base + dxRef.current;
    onAbrir(final < -ABERTO / 2); // passou da metade: fica aberto
    dxRef.current = 0;
    setDx(0);
  }

  function clique(ev: React.MouseEvent) {
    // O clique que o navegador dispara ao soltar um arrasto não navega nem fecha.
    if (moveu.current) {
      ev.preventDefault();
      moveu.current = false;
      return;
    }
    // Com a ação aberta, um toque na linha só fecha.
    if (aberto) {
      ev.preventDefault();
      onAbrir(false);
    }
  }

  return (
    <li className="lista-linha">
      <div className="lista-acoes" aria-hidden={!aberto}>
        <button
          type="button"
          className="lista-excluir"
          tabIndex={aberto ? 0 : -1}
          onClick={onExcluir}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
          </svg>
          Excluir
        </button>
      </div>
      <Link
        href={`/gravacao/${g.id}`}
        className={`lista-card${arrastando ? ' arrastando' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        draggable={false}
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerCancel={fim}
        onClick={clique}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pilula>{ORIGEM[g.source]}</Pilula>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {formatDateBR(g.created_at)}
            </span>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {g.title.trim() || 'Sem título'}
          </p>
        </div>
        <StatusBadge status={g.status} />
        {/* Mesma ação, acessível sem arrastar (teclado e mouse). */}
        <button
          type="button"
          className="lista-excluir-atalho"
          aria-label={`Excluir ${g.title.trim() || 'gravação sem título'}`}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onExcluir();
          }}
          onPointerDown={(ev) => ev.stopPropagation()}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
          </svg>
        </button>
      </Link>
    </li>
  );
}
