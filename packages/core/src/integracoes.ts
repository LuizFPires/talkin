import type { AtaContent } from './extraction';

/** Regra automática por evento de agenda (SPEC 20). */
export type RegraCalendario = {
  tituloContem?: string;
  participante?: string;
  templateKey?: string;
  projectName?: string;
};

/** Sugere modelo/projeto a partir de um evento (título + participantes). Puro. */
export function sugerirPorEvento(
  titulo: string,
  participantes: string[],
  regras: RegraCalendario[],
): { templateKey?: string; projectName?: string } {
  const t = titulo.toLowerCase();
  const nomes = participantes.map((p) => p.toLowerCase());
  for (const r of regras) {
    const okTitulo = r.tituloContem ? t.includes(r.tituloContem.toLowerCase()) : true;
    const okPart = r.participante ? nomes.includes(r.participante.toLowerCase()) : true;
    if ((r.tituloContem || r.participante) && okTitulo && okPart) {
      return { templateKey: r.templateKey, projectName: r.projectName };
    }
  }
  return {};
}

export type WebhookPayload = {
  recordingId: string;
  title: string;
  revisada: boolean;
  decisoes: { texto: string; minuto_ms: number | null }[];
  pendencias: {
    texto: string;
    responsavel: string | null;
    prazo: string | null;
    minuto_ms: number | null;
  }[];
};

/** Monta o payload enviado ao ioo/webhook (só o acionável da ata). */
export function buildWebhookPayload(
  recordingId: string,
  title: string,
  ata: AtaContent,
  revisada: boolean,
): WebhookPayload {
  return {
    recordingId,
    title,
    revisada,
    decisoes: ata.extracao.decisoes.map((d) => ({ texto: d.texto, minuto_ms: d.minuto_ms })),
    pendencias: ata.extracao.pendencias.map((p) => ({
      texto: p.texto,
      responsavel: p.responsavel,
      prazo: p.prazo,
      minuto_ms: p.minuto_ms,
    })),
  };
}
