import { NextResponse } from 'next/server';
import { AtaContent } from '@talkin/core';
import { buildAtaHtml, renderAtaPdf, type AtaDoc } from '@talkin/pdf';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 120;

/** Baixa a ata em PDF (Executiva). GET ?recordingId=... — respeita RLS do usuário. */
export async function GET(request: Request) {
  const recordingId = new URL(request.url).searchParams.get('recordingId') ?? '';
  if (!ehUuid(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Carrega via RLS do usuário (só vê o que pode).
  const { data: rec } = await supabase
    .from('recordings')
    .select('id, title, source, duration_s, created_at, organization_id, status')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  const { data: summary } = await supabase
    .from('summaries')
    .select('content, status')
    .eq('recording_id', recordingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const parsed = summary?.content ? AtaContent.safeParse(summary.content) : null;
  if (!parsed?.success) {
    return NextResponse.json({ error: 'Ata ainda não disponível.' }, { status: 409 });
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('nome_fantasia, cnpj, cidade, uf, site, accent_color, pdf_template, logo_url')
    .eq('id', rec.organization_id)
    .maybeSingle();

  // Logo embutida como data: URI (nunca URL externa — anti-SSRF no render).
  let logoDataUri: string | null = null;
  if (org?.logo_url) {
    const { data: blob } = await supabase.storage.from('logos').download(org.logo_url);
    if (blob) {
      const b64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
      logoDataUri = `data:${blob.type || 'image/png'};base64,${b64}`;
    }
  }

  const doc: AtaDoc = {
    org: {
      nome_fantasia: org?.nome_fantasia ?? 'Empresa',
      cnpj: org?.cnpj ?? null,
      cidade: org?.cidade ?? null,
      uf: org?.uf ?? null,
      site: org?.site ?? null,
      accent_color: org?.accent_color ?? null,
      logo_url: logoDataUri,
    },
    recording: {
      title: rec.title ?? '',
      date: rec.created_at,
      durationS: rec.duration_s,
      source: rec.source,
      revisada: summary?.status === 'revisada',
    },
    ata: parsed.data,
    template: org?.pdf_template ?? 'executiva',
  };

  // ?formato=html devolve a versão imprimível (também é o fallback se o Chromium falhar).
  const soHtml = new URL(request.url).searchParams.get('formato') === 'html';
  if (!soHtml) {
    try {
      const pdf = await renderAtaPdf(doc);
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="ata-${recordingId}.pdf"`,
        },
      });
    } catch {
      // Sem navegador disponível: cai para o HTML imprimível abaixo (nunca um erro seco).
    }
  }
  return new NextResponse(htmlImprimivel(buildAtaHtml(doc), `/gravacao/${recordingId}`), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      // A página contém texto da transcrição/cadastro: nenhum script roda aqui,
      // só estilos inline e fontes do Google (as mesmas do render em PDF).
      'content-security-policy': [
        "default-src 'none'",
        'img-src data:',
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "script-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    },
  });
}

/** A mesma ata, aberta no navegador com uma faixa "Imprimir / Salvar como PDF". */
function htmlImprimivel(html: string, voltar: string): string {
  // Sem script (CSP script-src 'none'): a instrução é pelo atalho/menu do navegador.
  const faixa = `<div id="talkin-print" style="position:sticky;top:0;z-index:9;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;padding:10px 16px;background:#0f1c1d;color:#f5f5f7;font:14px Inter,system-ui,sans-serif">
  <a href="${voltar}" style="color:#94efda;text-decoration:none;font-weight:600">← Voltar ao Talkin</a>
  <span>Para salvar em PDF: <strong>Ctrl+P</strong> (ou menu do navegador → Imprimir) e escolha <strong>Salvar como PDF</strong>.</span>
</div>
<style>@media print { #talkin-print { display:none } }</style>`;
  return html.includes('<body') ? html.replace(/<body([^>]*)>/, `<body$1>${faixa}`) : faixa + html;
}
