import { formatBRL, formatDateBR, formatMinute } from '@talkin/core';
import type { AtaDoc } from './types';

const MENTA = '#94efda';

function esc(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function pill(text: string, mono = false): string {
  return `<span class="pill${mono ? ' mono' : ''}">${esc(text)}</span>`;
}

function rotulo(text: string): string {
  return `<div class="rotulo">${esc(text)}</div>`;
}

function minutos(ms: number[]): string {
  return ms.map((m) => pill(formatMinute(m), true)).join(' ');
}

/** HTML da ata no estilo Human (fonte Sora). Executiva é o padrão (SPEC 28). */
export function buildAtaHtml(doc: AtaDoc): string {
  // Validação antes de interpolar no <style>/class (anti-injeção de CSS/HTML).
  const accent = /^#[0-9a-fA-F]{6}$/.test(doc.org.accent_color ?? '')
    ? doc.org.accent_color!
    : MENTA;
  const template = (['executiva', 'formal', 'painel'] as const).includes(
    doc.template as 'executiva' | 'formal' | 'painel',
  )
    ? doc.template!
    : 'executiva';
  const { ata, recording, org } = doc;
  const ex = ata.extracao;

  // Só aceita logo https/data/blob (bloqueia http/file e SSRF no render server-side).
  // O worker deve passar a logo como data: URI; sem logo válida, usa o nome fantasia.
  const rawLogo = org.logo_light_url || org.logo_url;
  const logo = rawLogo && /^(https:|data:|blob:)/i.test(rawLogo) ? rawLogo : null;
  const marca = logo
    ? `<img src="${esc(logo)}" alt="${esc(org.nome_fantasia)}" style="max-height:40px" />`
    : `<div style="font-family:'Sora';font-weight:600;font-size:20px">${esc(org.nome_fantasia)}</div>`;

  const duracao = recording.durationS ? formatMinute(recording.durationS * 1000) : '—';
  const totalValores = ex.valores
    .filter((v) => v.unidade === 'R$')
    .reduce((s, v) => s + v.valor, 0);

  const cards = [
    { label: 'Duração', valor: duracao },
    { label: 'Participantes', valor: String(recording.participants?.length ?? '—') },
    { label: 'Decisões', valor: String(ex.decisoes.length) },
    { label: 'Pendências', valor: String(ex.pendencias.length), destaque: true },
  ]
    .map(
      (c) =>
        `<div class="card ${c.destaque ? 'card-destaque' : ''}">
          ${rotulo(c.label)}
          <div class="num">${esc(c.valor)}</div>
        </div>`,
    )
    .join('');

  const secoes = ata.secoes
    .map(
      (s) => `<section class="bloco">
        ${rotulo(s.title)}
        <p>${esc(s.body)}</p>
        <div class="minutos">${minutos(s.minutos_ms)}</div>
      </section>`,
    )
    .join('');

  const decisoes = ex.decisoes.length
    ? `<section class="bloco">${rotulo('Decisões')}<ul>${ex.decisoes
        .map(
          (d) =>
            `<li>${esc(d.texto)} ${d.quem ? pill(d.quem) : ''} ${d.minuto_ms !== null ? pill(formatMinute(d.minuto_ms), true) : ''}</li>`,
        )
        .join('')}</ul></section>`
    : '';

  const pendencias = ex.pendencias.length
    ? `<section class="bloco">${rotulo('Pendências')}<ul>${ex.pendencias
        .map(
          (p) =>
            `<li>${esc(p.texto)} ${pill(p.responsavel ?? 'sem responsável')} ${p.prazo ? pill(formatDateBR(p.prazo)) : ''} ${p.minuto_ms !== null ? pill(formatMinute(p.minuto_ms), true) : ''}</li>`,
        )
        .join('')}</ul></section>`
    : '';

  const valores = ex.valores.length
    ? `<section class="bloco">${rotulo('Valores citados')}<ul>${ex.valores
        .map(
          (v) =>
            `<li>${esc(v.descricao)} — ${esc(v.unidade === 'R$' ? formatBRL(v.valor) : `${v.valor} ${v.unidade}`)} ${v.minuto_ms !== null ? pill(formatMinute(v.minuto_ms), true) : ''}</li>`,
        )
        .join(
          '',
        )}</ul>${totalValores > 0 ? `<div class="total">${pill(`Total: ${formatBRL(totalValores)}`)}</div>` : ''}</section>`
    : '';

  const prazos = ex.prazos.length
    ? `<section class="bloco">${rotulo('Próximas datas')}<ul>${ex.prazos
        .map((p) => `<li>${pill(formatDateBR(p.data))} ${esc(p.evento)}</li>`)
        .join('')}</ul></section>`
    : '';

  const riscos = ex.riscos.length
    ? `<section class="bloco">${rotulo('Riscos')}<ul>${ex.riscos
        .map((r) => `<li>${pill(r.gravidade)} ${esc(r.texto)}</li>`)
        .join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Sora', system-ui, sans-serif; color: #1a1a1a; }
  @page { size: A4; margin: 0; }
  .page { padding: 32px 40px; }
  .header { background: linear-gradient(to bottom, #071416, #172a2b); color: #f5f7f7; border-radius: 24px; padding: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .selo { border: 1px solid var(--accent); color: var(--accent); border-radius: 9999px; padding: 2px 10px; font-size: 11px; }
  h1 { font-size: 22px; margin: 16px 0 4px; }
  .meta { color: #98a7a7; font-size: 12px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
  .card { border: 1px solid #e3e6e6; border-radius: 16px; padding: 12px; }
  .card-destaque { background: #071416; color: #f5f7f7; }
  .card-destaque .num { color: var(--accent); }
  .num { font-size: 26px; font-weight: 600; margin-top: 6px; }
  .rotulo { text-transform: uppercase; font-size: 11px; font-weight: 500; letter-spacing: .18em; color: #798e91; }
  .bloco { margin: 14px 0; break-inside: avoid; } /* nunca título órfão */
  .bloco p { font-size: 13px; line-height: 1.55; margin: 6px 0; }
  ul { margin: 6px 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
  .pill { display: inline-flex; align-items: center; border: 1px solid #d5dada; border-radius: 9999px; padding: 1px 8px; font-size: 11px; }
  .pill.mono { font-family: 'JetBrains Mono', monospace; }
  .total { margin-top: 8px; }
  .footer { margin-top: 24px; border-top: 1px solid #e3e6e6; padding-top: 10px; color: #798e91; font-size: 11px; display: flex; justify-content: space-between; }
  .tpl-formal .header { background: #fff; color: #1a1a1a; border: 1px solid #1a1a1a; border-radius: 0; }
  .tpl-painel .page { display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
</style></head>
<body class="tpl-${template}">
  <div class="page">
    <div class="header">
      <div>${marca}<h1>${esc(recording.title || 'Ata da reunião')}</h1>
        <div class="meta">${esc(formatDateBR(recording.date))}${recording.source ? ` · ${esc(recording.source)}` : ''}</div>
      </div>
      ${recording.revisada ? '<span class="selo">Revisada</span>' : ''}
    </div>
    <div class="cards">${cards}</div>
    ${ata.resumo ? `<section class="bloco">${rotulo('Resumo')}<p>${esc(ata.resumo)}</p></section>` : ''}
    ${secoes}
    ${decisoes}
    ${pendencias}
    ${valores}
    ${prazos}
    ${riscos}
    <div class="footer">
      <span>${esc([org.nome_fantasia, org.cnpj, org.site].filter(Boolean).join(' · '))}</span>
      <span>Gerada a partir da gravação</span>
    </div>
  </div>
</body></html>`;
}
