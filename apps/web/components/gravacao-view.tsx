'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type AtaContent,
  type EdicaoBloco,
  aplicarEdicao,
  chavesComConteudo,
  formatDateBR,
  formatMinute,
  marcarConferida,
  type RecordingStatus,
} from '@talkin/core';
import { Card, Pilula, Rotulo, ToggleSegmentado } from '@talkin/ui';
import { StatusBadge } from './status-badge';
import { MenuGravacao, type AcaoMenu } from './menu-gravacao';
import { RevisaoAta } from './revisao-ata';
import { createClient } from '@/lib/supabase/client';

type Seg = { startMs: number; endMs: number; text: string; falante: string };
type Template = { id: string; key: string; name: string };
type StatusAta = 'rascunho' | 'revisada';

/** Texto formatado para colar no WhatsApp (SPEC 18). */
function textoWhatsapp(titulo: string, ata: AtaContent): string {
  const linhas = [`*${titulo}*`, '', ata.resumo].filter(Boolean);
  if (ata.extracao.decisoes.length) {
    linhas.push('', '*Decisões*');
    for (const d of ata.extracao.decisoes) linhas.push(`• ${d.texto}`);
  }
  if (ata.extracao.pendencias.length) {
    linhas.push('', '*Pendências*');
    for (const p of ata.extracao.pendencias) {
      linhas.push(
        `• ${p.texto}${p.responsavel ? ` — ${p.responsavel}` : ''}${p.prazo ? ` (${formatDateBR(p.prazo)})` : ''}`,
      );
    }
  }
  return linhas.join('\n');
}

export function GravacaoView({
  recordingId,
  titulo: tituloInicial,
  status,
  criadoEm,
  duracaoS,
  ata: ataInicial,
  statusAta: statusAtaInicial,
  podeEditar,
  temWebhook,
  segments,
  audioUrl,
  templates,
  templateId,
  erroProcessamento = null,
}: {
  recordingId: string;
  titulo: string;
  status: RecordingStatus;
  criadoEm: string;
  duracaoS: number | null;
  ata: AtaContent | null;
  statusAta: StatusAta | null;
  /** Dono/admin/gestor: pode revisar, editar, renomear e excluir. */
  podeEditar: boolean;
  /** A empresa tem webhook (ioo) configurado: ao concluir a revisão, envia. */
  temWebhook: boolean;
  segments: Seg[];
  audioUrl: string | null;
  templates: Template[];
  templateId: string | null;
  /** Motivo curto do último erro do pipeline (só quando status = erro). */
  erroProcessamento?: string | null;
}) {
  const router = useRouter();
  const [aba, setAba] = useState('ata');
  const [ata, setAta] = useState<AtaContent | null>(ataInicial);
  const [statusAta, setStatusAta] = useState<StatusAta | null>(statusAtaInicial);
  const [reaberta, setReaberta] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [etapaInfo, setEtapaInfo] = useState<'gravada' | 'revisar' | 'salva' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [rascunhoTitulo, setRascunhoTitulo] = useState(tituloInicial);
  const [modeloAberto, setModeloAberto] = useState(false);
  const [modelo, setModelo] = useState(templateId ?? '');
  const [regenerando, setRegenerando] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  // Props novas (router.refresh após regenerar/renomear) sincronizam o estado local.
  useEffect(() => setAta(ataInicial), [ataInicial]);
  useEffect(() => setStatusAta(statusAtaInicial), [statusAtaInicial]);
  useEffect(() => {
    setTitulo(tituloInicial);
    setRascunhoTitulo(tituloInicial);
  }, [tituloInicial]);
  useEffect(() => {
    if (editandoTitulo) tituloRef.current?.select();
  }, [editandoTitulo]);

  // Avisos somem sozinhos.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const revisada = statusAta === 'revisada';
  const salva = revisada && !reaberta;
  const chaves = ata ? chavesComConteudo(ata) : [];
  const conferidas = ata ? chaves.filter((c) => ata.revisao.conferidas.includes(c)).length : 0;

  // ───────────────────────────── título ─────────────────────────────

  async function salvarTitulo() {
    const t = rascunhoTitulo.trim();
    setEditandoTitulo(false);
    if (!t || t === titulo) {
      setRascunhoTitulo(titulo);
      return;
    }
    const { data, error } = await createClient()
      .from('recordings')
      .update({ title: t })
      .eq('id', recordingId)
      .select('id');
    if (error || !data?.length) {
      setRascunhoTitulo(titulo);
      setAviso('Não foi possível renomear. Só quem gravou ou um admin pode.');
      return;
    }
    setTitulo(t);
    setAviso('Título salvo.');
    router.refresh();
  }

  // ───────────────────────────── revisão ─────────────────────────────

  async function chamarRevisar(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('/api/ata/revisar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordingId, ...body }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setAviso(b.error ?? 'Não foi possível salvar.');
      return false;
    }
    return true;
  }

  async function onConferir(chave: string, ok: boolean) {
    if (!ata) return;
    const antes = ata;
    setAta(marcarConferida(ata, chave, ok)); // otimista
    if (!(await chamarRevisar({ acao: 'conferir', chave, ok }))) setAta(antes);
    else if (salva) setReaberta(true);
  }

  async function onEditar(edicao: EdicaoBloco) {
    if (!ata) return;
    const antes = ata;
    const depois = aplicarEdicao(ata, edicao);
    setAta(depois);
    if (!(await chamarRevisar({ acao: 'editar', edicao }))) {
      setAta(antes);
      throw new Error('falha ao salvar');
    }
    setAviso('Seção salva · editada por você.');
    if (salva) setReaberta(true);
  }

  async function concluir() {
    if (!ata || concluindo) return;
    setConcluindo(true);
    try {
      if (reaberta && revisada) {
        // Já é Revisada: as edições foram salvas seção a seção.
        setReaberta(false);
        setAviso('Alterações salvas.');
        return;
      }
      if (!(await chamarRevisar({ acao: 'concluir' }))) return;
      setStatusAta('revisada');
      setReaberta(false);
      setAta({
        ...ata,
        revisao: { ...ata.revisao, conferidas: chaves },
      });
      setEtapaInfo(null);
      setAviso('Revisão concluída · ata salva como Revisada.');
      if (temWebhook) void enviarIoo(true);
      router.refresh();
    } finally {
      setConcluindo(false);
    }
  }

  async function enviarIoo(automatico = false) {
    const res = await fetch('/api/integracoes/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordingId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setAviso(
      res.ok
        ? automatico
          ? 'Ata salva e enviada ao ioo.'
          : 'Enviado ao ioo.'
        : (body.error ?? 'Falha ao enviar ao ioo.'),
    );
  }

  // ───────────────────────────── modelo / regenerar ─────────────────────────────

  async function regenerar(templateIdNovo?: string | null) {
    setRegenerando(true);
    setAviso(null);
    const res = await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        templateIdNovo === undefined
          ? { recordingId }
          : { recordingId, templateId: templateIdNovo || null },
      ),
    });
    setRegenerando(false);
    setModeloAberto(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setAviso(b.error ?? 'Falha ao regenerar.');
      return;
    }
    setAviso('Ata regenerada. As seções que você editou foram mantidas.');
    router.refresh();
  }

  // ───────────────────────────── saídas ─────────────────────────────

  async function copiarWhatsapp() {
    if (!ata) return;
    try {
      await navigator.clipboard.writeText(textoWhatsapp(titulo, ata));
      setAviso('Texto copiado para o WhatsApp.');
    } catch {
      setAviso('Não consegui copiar. Tente de novo.');
    }
  }

  function enviarEmail() {
    if (!ata) return;
    const corpo = encodeURIComponent(textoWhatsapp(titulo, ata).replace(/\*/g, ''));
    // Abre o cliente de e-mail para o usuário revisar destinatários e texto (SPEC 18).
    window.location.href = `mailto:?subject=${encodeURIComponent(`Ata — ${titulo}`)}&body=${corpo}`;
  }

  async function criarLink(dias: number | null) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Token imprevisível (sem fallback fraco): 32 bytes aleatórios em hex.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const expires_at = dias ? new Date(Date.now() + dias * 86400000).toISOString() : null;
    const { error } = await supabase
      .from('shares')
      .insert({ recording_id: recordingId, token, expires_at, created_by: user.id });
    if (error) {
      setAviso(error.message);
      return;
    }
    const url = `${window.location.origin}/compartilhar/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setAviso(`Link copiado (${dias ? `${dias} dias` : 'sem expiração'}): ${url}`);
  }

  // ───────────────────────────── player ─────────────────────────────

  function tocarEm(ms: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    void a.play();
  }

  const MinutoPill = ({ ms }: { ms: number }) => (
    <button
      type="button"
      onClick={() => tocarEm(ms)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: audioUrl ? 'pointer' : 'default',
      }}
      disabled={!audioUrl}
      aria-label={`Tocar em ${formatMinute(ms)}`}
    >
      <Pilula mono>{formatMinute(ms)}</Pilula>
    </button>
  );

  // ───────────────────────────── menu ⋯ ─────────────────────────────

  const acoesMenu: AcaoMenu[] = podeEditar
    ? [
        {
          label: 'Renomear reunião',
          onClick: () => {
            setRascunhoTitulo(titulo === 'Sem título' ? '' : titulo);
            setEditandoTitulo(true);
          },
        },
        ...(ata
          ? [
              {
                label: 'Modelo da ata',
                descricao: templates.find((t) => t.id === (templateId ?? ''))?.name
                  ? `${templates.find((t) => t.id === templateId)!.name} · trocar regenera`
                  : 'trocar regenera as seções não editadas',
                onClick: () => setModeloAberto(true),
              },
              {
                label: regenerando ? 'Regenerando…' : 'Regenerar ata',
                descricao: 'Mantém o que você editou',
                onClick: () => void regenerar(),
              },
            ]
          : []),
        ...(revisada && temWebhook
          ? [{ label: 'Reenviar ao ioo', onClick: () => void enviarIoo() }]
          : []),
      ]
    : [];

  const infoEtapa: Record<'gravada' | 'revisar' | 'salva', React.ReactNode> = {
    gravada: (
      <>
        <strong>Gravada em {formatDateBR(criadoEm)}</strong>
        {duracaoS ? ` · ${Math.max(1, Math.round(duracaoS / 60))} min` : ''}. Áudio, transcrição e
        ata já estão salvos. Nada a fazer nesta etapa.
      </>
    ),
    revisar: (
      <>
        <strong>Você está aqui.</strong> Leia cada seção e marque ✓. Para corrigir, toque em ✎
        Editar na seção. Quando terminar, Concluir revisão.
      </>
    ),
    salva: salva ? (
      <>
        <strong>Ata revisada e salva.</strong> As saídas estão liberadas no rodapé. Precisa mudar
        algo? Toque em Editar de novo.
      </>
    ) : (
      <>
        Fica disponível depois de concluir a revisão. Aí a ata vira <strong>Revisada</strong> e
        liberam as saídas (WhatsApp, PDF, DOCX, e-mail, link).
      </>
    ),
  };

  const gravadaOk = status === 'pronto' || Boolean(ata);
  const revisarAtual = Boolean(ata) && !salva;

  // ───────────────────────────── UI ─────────────────────────────

  return (
    <div className="rev-pagina">
      <header className="rev-cabecalho">
        <Rotulo>Reunião · {formatDateBR(criadoEm)}</Rotulo>

        {/* Etapas: estado da reunião, não navegação. Tocar explica. */}
        {ata && (
          <div className="rev-passos" role="group" aria-label="Etapas da reunião">
            <button
              type="button"
              className={`${gravadaOk ? 'feito' : ''}${etapaInfo === 'gravada' ? ' sel' : ''}`}
              onClick={() => setEtapaInfo(etapaInfo === 'gravada' ? null : 'gravada')}
            >
              <span className="b" />
              Gravada
            </button>
            <i className={gravadaOk ? 'feito' : ''} />
            <button
              type="button"
              className={`${salva ? 'feito' : revisarAtual ? 'atual' : ''}${etapaInfo === 'revisar' ? ' sel' : ''}`}
              onClick={() => setEtapaInfo(etapaInfo === 'revisar' ? null : 'revisar')}
            >
              <span className="b" />
              {salva ? 'Revisada' : 'Revisar'}
            </button>
            <i className={salva ? 'feito' : ''} />
            <button
              type="button"
              className={`${salva ? 'feito atual' : ''}${etapaInfo === 'salva' ? ' sel' : ''}`}
              onClick={() => setEtapaInfo(etapaInfo === 'salva' ? null : 'salva')}
            >
              <span className="b" />
              Salva
            </button>
          </div>
        )}
        {etapaInfo && <div className="rev-etapa-info">{infoEtapa[etapaInfo]}</div>}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {editandoTitulo ? (
            <input
              ref={tituloRef}
              className="rev-titulo-input"
              value={rascunhoTitulo}
              placeholder="Dê um nome à reunião"
              onChange={(e) => setRascunhoTitulo(e.target.value)}
              onBlur={() => void salvarTitulo()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setRascunhoTitulo(titulo);
                  setEditandoTitulo(false);
                }
              }}
              aria-label="Título da reunião"
            />
          ) : (
            <h1
              className={`rev-titulo${podeEditar ? ' editavel' : ''}${titulo === 'Sem título' ? ' vazio' : ''}`}
              onClick={() => {
                if (!podeEditar) return;
                setRascunhoTitulo(titulo === 'Sem título' ? '' : titulo);
                setEditandoTitulo(true);
              }}
              title={podeEditar ? 'Toque para renomear' : undefined}
            >
              {titulo === 'Sem título' && podeEditar ? 'Sem título — toque para nomear' : titulo}
            </h1>
          )}
          {podeEditar && !editandoTitulo && (
            <button
              type="button"
              className="rev-redondo"
              aria-label="Renomear reunião"
              onClick={() => {
                setRascunhoTitulo(titulo === 'Sem título' ? '' : titulo);
                setEditandoTitulo(true);
              }}
            >
              ✎
            </button>
          )}
          <MenuGravacao recordingId={recordingId} titulo={titulo} acoes={acoesMenu} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={status} />
          {statusAta && (
            <span className={`rev-status ${revisada ? 'ok' : 'aviso'}`}>
              <i />
              {revisada ? (reaberta ? 'Revisada · editando' : 'Revisada') : 'Rascunho'}
            </span>
          )}
          {duracaoS ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {Math.max(1, Math.round(duracaoS / 60))} min
            </span>
          ) : null}
        </div>
      </header>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          preload="metadata"
          style={{ width: '100%', marginBottom: 16 }}
          onLoadedMetadata={(ev) => {
            // Áudio do MediaRecorder (webm) não declara duração: o player mostra
            // "--:--" e não deixa arrastar. Pular para o fim força o navegador a
            // calcular a duração; depois volta ao início.
            const a = ev.currentTarget;
            if (a.duration === Infinity) {
              const voltar = () => {
                a.removeEventListener('timeupdate', voltar);
                a.currentTime = 0;
              };
              a.addEventListener('timeupdate', voltar);
              a.currentTime = 1e101;
            }
          }}
        />
      )}

      <div style={{ marginBottom: 16 }}>
        <ToggleSegmentado
          value={aba}
          onChange={setAba}
          options={[
            { value: 'ata', label: 'Ata' },
            { value: 'transcricao', label: 'Transcrição' },
            { value: 'pergunte', label: 'Pergunte' },
          ]}
        />
      </div>

      {aba === 'ata' &&
        (ata ? (
          <RevisaoAta
            ata={ata}
            MinutoPill={MinutoPill}
            bloqueada={!podeEditar}
            onConferir={onConferir}
            onEditar={onEditar}
          />
        ) : (
          <SemAta
            erro={status === 'erro' ? (erroProcessamento ?? 'motivo não registrado') : null}
            onRegenerar={podeEditar ? () => void regenerar() : undefined}
            regenerando={regenerando}
          />
        ))}
      {aba === 'transcricao' && <AbaTranscricao segments={segments} MinutoPill={MinutoPill} />}
      {aba === 'pergunte' && <AbaPergunte recordingId={recordingId} MinutoPill={MinutoPill} />}

      {/* Rodapé da revisão: um botão só, que muda de nome conforme o momento. */}
      {ata && podeEditar && aba === 'ata' && (
        <div className="rev-rodape">
          {salva && (
            <div className="rev-saidas">
              <button type="button" className="rev-saida" onClick={() => void copiarWhatsapp()}>
                <span className="i">WA</span>WhatsApp
              </button>
              <a
                className="rev-saida"
                href={`/api/pdf?recordingId=${recordingId}`}
                target="_blank"
                rel="noopener"
              >
                <span className="i pdf">PDF</span>PDF
              </a>
              <a
                className="rev-saida"
                href={`/api/docx?recordingId=${recordingId}`}
                target="_blank"
                rel="noopener"
              >
                <span className="i">DOC</span>DOCX
              </a>
              <button type="button" className="rev-saida" onClick={enviarEmail}>
                <span className="i">@</span>E-mail
              </button>
              <button type="button" className="rev-saida" onClick={() => void criarLink(30)}>
                <span className="i">🔗</span>Link
              </button>
            </div>
          )}
          {!salva && (
            <>
              <div className="rev-prog">
                <span
                  style={{ width: `${chaves.length ? (conferidas / chaves.length) * 100 : 0}%` }}
                />
              </div>
              <div className="rev-linha">
                <span>
                  {conferidas === chaves.length
                    ? 'Tudo conferido. Pode concluir.'
                    : `Confira as ${chaves.length} seções (ou toque em Concluir e conferimos todas)`}
                </span>
                <span>
                  {conferidas}/{chaves.length}
                </span>
              </div>
            </>
          )}
          {salva ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="rev-btn pri salvo" disabled style={{ flex: 1 }}>
                ✓ Ata salva · Revisada
              </button>
              <button type="button" className="rev-btn" onClick={() => setReaberta(true)}>
                Editar de novo
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="rev-btn pri grande"
              onClick={() => void concluir()}
              disabled={concluindo}
            >
              {concluindo ? 'Salvando…' : reaberta ? 'Salvar alterações' : 'Concluir revisão'}
            </button>
          )}
        </div>
      )}

      {aviso && (
        <div className="rev-toast" role="status">
          {aviso}
        </div>
      )}

      {modeloAberto && (
        <div className="confirmacao-fundo" onClick={() => !regenerando && setModeloAberto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Modelo da ata"
            className="confirmacao"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Modelo da ata</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Trocar o modelo regenera a ata. As seções que você editou são mantidas.
            </p>
            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              aria-label="Modelo de ata"
              className="rev-select"
              autoFocus
            >
              <option value="">Padrão (genérico)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="confirmacao-cancelar"
                onClick={() => setModeloAberto(false)}
                disabled={regenerando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rev-btn pri"
                onClick={() => void regenerar(modelo || null)}
                disabled={regenerando}
              >
                {regenerando ? 'Regenerando…' : 'Regenerar com este modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SemAta({
  erro,
  onRegenerar,
  regenerando,
}: {
  erro: string | null;
  onRegenerar?: () => void;
  regenerando: boolean;
}) {
  return (
    <Card>
      {erro ? (
        <>
          <p style={{ color: 'var(--danger)', fontSize: 14, margin: 0, fontWeight: 600 }}>
            A geração da ata falhou.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0' }}>
            Motivo: <code style={{ fontFamily: 'var(--font-mono)' }}>{erro}</code>. A gravação e a
            transcrição estão salvas.
          </p>
          {onRegenerar && (
            <button
              type="button"
              className="rev-btn pri"
              style={{ marginTop: 12 }}
              onClick={onRegenerar}
              disabled={regenerando}
            >
              {regenerando ? 'Tentando…' : 'Tentar de novo'}
            </button>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Ata ainda não disponível. Ela aparece quando o processamento termina.
        </p>
      )}
    </Card>
  );
}

function AbaPergunte({
  recordingId,
  MinutoPill,
}: {
  recordingId: string;
  MinutoPill: (p: { ms: number }) => React.ReactNode;
}) {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<string | null>(null);
  const [citacoes, setCitacoes] = useState<{ startMs: number }[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function perguntar() {
    if (pergunta.trim().length < 3) return;
    setCarregando(true);
    setResposta(null);
    const res = await fetch('/api/perguntar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta, recordingId }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      resposta?: string;
      citacoes?: { startMs: number }[];
    };
    setResposta(body.resposta ?? 'Não foi possível responder.');
    setCitacoes(body.citacoes ?? []);
    setCarregando(false);
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void perguntar()}
          placeholder="O que foi combinado sobre o prazo da estrutura?"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 'var(--radius-menu)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={() => void perguntar()}
          disabled={carregando}
          className="rev-btn"
        >
          {carregando ? '…' : 'Perguntar'}
        </button>
      </div>
      {resposta && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>{resposta}</p>
          {citacoes.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Rotulo>Fontes</Rotulo>
              {citacoes.map((c, i) => (
                <MinutoPill key={i} ms={c.startMs} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AbaTranscricao({
  segments,
  MinutoPill,
}: {
  segments: Seg[];
  MinutoPill: (p: { ms: number }) => React.ReactNode;
}) {
  if (!segments.length) {
    return (
      <Card>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Transcrição ainda não disponível.
        </p>
      </Card>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {segments.map((s, i) => (
        <Card key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 92 }}>
            <MinutoPill ms={s.startMs} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.falante}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{s.text}</p>
        </Card>
      ))}
    </div>
  );
}
