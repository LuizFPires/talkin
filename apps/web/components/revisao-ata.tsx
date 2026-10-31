'use client';

import { useState } from 'react';
import {
  type AtaContent,
  type Decisao,
  type EdicaoBloco,
  type PendenciaExtraida,
  type ValorCitado,
  formatBRL,
} from '@talkin/core';
import { Card, Pilula, Rotulo } from '@talkin/ui';

type MinutoPill = (p: { ms: number }) => React.ReactNode;

/**
 * Revisão guiada (SPEC 12): cada bloco da ata tem ✓ Conferi e ✎ Editar. Em edição,
 * o texto vira editável, itens de lista ganham × e "+ Adicionar"; Pronto salva
 * (e marca como conferido e editado), Descartar volta ao que era.
 */
export function RevisaoAta({
  ata,
  MinutoPill,
  bloqueada,
  onConferir,
  onEditar,
}: {
  ata: AtaContent;
  MinutoPill: MinutoPill;
  /** Sem permissão de edição (visibilidade só-leitura): esconde ✓ e ✎. */
  bloqueada: boolean;
  onConferir: (chave: string, ok: boolean) => Promise<void>;
  onEditar: (edicao: EdicaoBloco) => Promise<void>;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const { extracao, revisao } = ata;
  const conferida = (c: string) => revisao.conferidas.includes(c);
  const editada = (c: string) => revisao.editadas.includes(c);

  const cab = (chave: string, titulo: string) => (
    <div className="rev-cab">
      <Rotulo>{titulo}</Rotulo>
      {editada(chave) && <span className="rev-tag">editada</span>}
      {!bloqueada && editando !== chave && (
        <button type="button" className="rev-editar" onClick={() => setEditando(chave)}>
          ✎ Editar
        </button>
      )}
      {!bloqueada && (
        <button
          type="button"
          className={`rev-check${conferida(chave) ? ' ok' : ''}`}
          aria-label={conferida(chave) ? `Desmarcar ${titulo}` : `Conferi ${titulo}`}
          aria-pressed={conferida(chave)}
          onClick={() => void onConferir(chave, !conferida(chave))}
        >
          ✓
        </button>
      )}
    </div>
  );

  const cardClass = (chave: string) =>
    `rev-card${editando === chave ? ' editando' : ''}${conferida(chave) ? ' conferida' : ''}`;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {(ata.resumo || editando === 'resumo') && (
        <Card className={cardClass('resumo')}>
          {cab('resumo', 'Resumo')}
          {editando === 'resumo' ? (
            <EditorTexto
              inicial={ata.resumo}
              onPronto={async (texto) => {
                await onEditar({ tipo: 'texto', chave: 'resumo', texto });
                setEditando(null);
              }}
              onDescartar={() => setEditando(null)}
            />
          ) : (
            <p className="rev-texto">{ata.resumo}</p>
          )}
        </Card>
      )}

      {ata.secoes.map((s) => {
        const chave = `secao:${s.key}`;
        return (
          <Card key={s.key} className={cardClass(chave)}>
            {cab(chave, s.title)}
            {editando === chave ? (
              <EditorTexto
                inicial={s.body}
                onPronto={async (texto) => {
                  await onEditar({ tipo: 'texto', chave, texto });
                  setEditando(null);
                }}
                onDescartar={() => setEditando(null)}
              />
            ) : (
              <>
                <p className="rev-texto">{s.body}</p>
                {s.minutos_ms.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.minutos_ms.map((ms, i) => (
                      <MinutoPill key={i} ms={ms} />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}

      {(extracao.decisoes.length > 0 || editando === 'decisoes') && (
        <Card className={cardClass('decisoes')}>
          {cab('decisoes', 'Decisões')}
          <EditorLista<Decisao>
            ativo={editando === 'decisoes'}
            itens={extracao.decisoes}
            texto={(d) => d.texto}
            comTexto={(d, texto) => ({ ...d, texto })}
            novo={() => ({ texto: '', minuto_ms: null, quem: null })}
            extra={(d) => (d.quem ? <Pilula>{d.quem}</Pilula> : null)}
            minuto={(d) => d.minuto_ms}
            MinutoPill={MinutoPill}
            rotuloAdicionar="+ Adicionar decisão"
            onPronto={async (itens) => {
              await onEditar({ tipo: 'decisoes', itens });
              setEditando(null);
            }}
            onDescartar={() => setEditando(null)}
          />
        </Card>
      )}

      {(extracao.pendencias.length > 0 || editando === 'pendencias') && (
        <Card className={cardClass('pendencias')}>
          {cab('pendencias', 'Pendências')}
          <EditorLista<PendenciaExtraida>
            ativo={editando === 'pendencias'}
            itens={extracao.pendencias}
            texto={(p) => p.texto}
            comTexto={(p, texto) => ({ ...p, texto })}
            novo={() => ({
              texto: '',
              responsavel: null,
              prazo: null,
              prazo_estimado: false,
              minuto_ms: null,
            })}
            extra={(p) => <Pilula>{p.responsavel ?? 'sem responsável'}</Pilula>}
            minuto={(p) => p.minuto_ms}
            MinutoPill={MinutoPill}
            rotuloAdicionar="+ Adicionar pendência"
            onPronto={async (itens) => {
              await onEditar({ tipo: 'pendencias', itens });
              setEditando(null);
            }}
            onDescartar={() => setEditando(null)}
          />
        </Card>
      )}

      {(extracao.valores.length > 0 || editando === 'valores') && (
        <Card className={cardClass('valores')}>
          {cab('valores', 'Valores')}
          <EditorLista<ValorCitado>
            ativo={editando === 'valores'}
            itens={extracao.valores}
            texto={(v) => v.descricao}
            comTexto={(v, descricao) => ({ ...v, descricao })}
            novo={() => ({ descricao: '', valor: 0, unidade: 'R$', minuto_ms: null })}
            extra={(v) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                {v.unidade === 'R$'
                  ? formatBRL(v.valor)
                  : `${v.valor.toLocaleString('pt-BR')} ${v.unidade}`}
              </span>
            )}
            numero={{
              ler: (v) => v.valor,
              escrever: (v, valor) => ({ ...v, valor }),
              rotulo: 'Valor',
            }}
            minuto={(v) => v.minuto_ms}
            MinutoPill={MinutoPill}
            rotuloAdicionar="+ Adicionar valor"
            onPronto={async (itens) => {
              await onEditar({ tipo: 'valores', itens });
              setEditando(null);
            }}
            onDescartar={() => setEditando(null)}
          />
        </Card>
      )}
    </div>
  );
}

/** Texto corrido (resumo / seção do modelo) em edição. */
function EditorTexto({
  inicial,
  onPronto,
  onDescartar,
}: {
  inicial: string;
  onPronto: (texto: string) => Promise<void>;
  onDescartar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  return (
    <>
      <textarea
        className="rev-textarea"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={Math.min(14, Math.max(4, Math.ceil(texto.length / 60)))}
        autoFocus
        aria-label="Texto da seção"
      />
      <BarraEdicao
        salvando={salvando}
        onDescartar={onDescartar}
        onPronto={async () => {
          setSalvando(true);
          try {
            await onPronto(texto);
          } finally {
            setSalvando(false);
          }
        }}
      />
    </>
  );
}

/** Lista (decisões / pendências / valores): leitura ou edição item a item. */
function EditorLista<T>({
  ativo,
  itens: iniciais,
  texto,
  comTexto,
  novo,
  extra,
  numero,
  minuto,
  MinutoPill,
  rotuloAdicionar,
  onPronto,
  onDescartar,
}: {
  ativo: boolean;
  itens: T[];
  texto: (t: T) => string;
  comTexto: (t: T, texto: string) => T;
  novo: () => T;
  extra?: (t: T) => React.ReactNode;
  numero?: { ler: (t: T) => number; escrever: (t: T, n: number) => T; rotulo: string };
  minuto: (t: T) => number | null;
  MinutoPill: MinutoPill;
  rotuloAdicionar: string;
  onPronto: (itens: T[]) => Promise<void>;
  onDescartar: () => void;
}) {
  const [itens, setItens] = useState<T[]>(iniciais);
  const [salvando, setSalvando] = useState(false);
  // Ao entrar em edição, parte da lista atual.
  const [ativoAnt, setAtivoAnt] = useState(ativo);
  if (ativo !== ativoAnt) {
    setAtivoAnt(ativo);
    if (ativo) setItens(iniciais);
  }

  if (!ativo) {
    return (
      <ul className="rev-lista">
        {iniciais.map((t, i) => (
          <li key={i}>
            <span className="rev-item-texto">
              {texto(t)} {extra?.(t)}
            </span>
            {minuto(t) !== null && <MinutoPill ms={minuto(t)!} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ul className="rev-lista editando">
        {itens.map((t, i) => (
          <li key={i}>
            {minuto(t) !== null ? (
              <MinutoPill ms={minuto(t)!} />
            ) : (
              <span className="rev-sem-minuto" title="Item adicionado por você">
                —
              </span>
            )}
            <input
              className="rev-input"
              value={texto(t)}
              placeholder="Escreva o item"
              onChange={(e) =>
                setItens((l) => l.map((x, j) => (j === i ? comTexto(x, e.target.value) : x)))
              }
              aria-label={`Item ${i + 1}`}
            />
            {numero && (
              <input
                className="rev-input rev-numero"
                type="number"
                step="0.01"
                value={numero.ler(t)}
                aria-label={numero.rotulo}
                onChange={(e) =>
                  setItens((l) =>
                    l.map((x, j) => (j === i ? numero.escrever(x, Number(e.target.value)) : x)),
                  )
                }
              />
            )}
            <button
              type="button"
              className="rev-x"
              aria-label="Remover item"
              onClick={() => setItens((l) => l.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <BarraEdicao
        salvando={salvando}
        onDescartar={onDescartar}
        onPronto={async () => {
          setSalvando(true);
          try {
            await onPronto(itens.filter((t) => texto(t).trim().length > 0));
          } finally {
            setSalvando(false);
          }
        }}
        esquerda={
          <button type="button" className="rev-add" onClick={() => setItens((l) => [...l, novo()])}>
            {rotuloAdicionar}
          </button>
        }
      />
    </>
  );
}

function BarraEdicao({
  salvando,
  onPronto,
  onDescartar,
  esquerda,
}: {
  salvando: boolean;
  onPronto: () => void;
  onDescartar: () => void;
  esquerda?: React.ReactNode;
}) {
  return (
    <div className="rev-barra">
      {esquerda ?? <span className="rev-dica">Corrija o texto e toque em Pronto.</span>}
      <button type="button" className="rev-btn" onClick={onDescartar} disabled={salvando}>
        Descartar
      </button>
      <button type="button" className="rev-btn pri" onClick={onPronto} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Pronto'}
      </button>
    </div>
  );
}
