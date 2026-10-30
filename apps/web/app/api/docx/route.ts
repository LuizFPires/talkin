import { NextResponse } from 'next/server';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { AtaContent, formatBRL, formatDateBR } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 60;

/** Exporta a ata em DOCX (SPEC 18). GET ?recordingId=... — respeita RLS. */
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

  const { data: rec } = await supabase
    .from('recordings')
    .select('title, created_at')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  const { data: summary } = await supabase
    .from('summaries')
    .select('content')
    .eq('recording_id', recordingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const parsed = summary?.content ? AtaContent.safeParse(summary.content) : null;
  if (!parsed?.success) {
    return NextResponse.json({ error: 'Ata ainda não disponível.' }, { status: 409 });
  }
  const ata = parsed.data;

  const paras: Paragraph[] = [
    new Paragraph({ text: rec.title || 'Ata da reunião', heading: HeadingLevel.TITLE }),
    new Paragraph({ text: formatDateBR(rec.created_at) }),
  ];
  if (ata.resumo) {
    paras.push(new Paragraph({ text: 'Resumo', heading: HeadingLevel.HEADING_2 }));
    paras.push(new Paragraph({ text: ata.resumo }));
  }
  for (const s of ata.secoes) {
    paras.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }));
    paras.push(new Paragraph({ text: s.body }));
  }
  if (ata.extracao.decisoes.length) {
    paras.push(new Paragraph({ text: 'Decisões', heading: HeadingLevel.HEADING_2 }));
    for (const d of ata.extracao.decisoes)
      paras.push(new Paragraph({ text: d.texto, bullet: { level: 0 } }));
  }
  if (ata.extracao.pendencias.length) {
    paras.push(new Paragraph({ text: 'Pendências', heading: HeadingLevel.HEADING_2 }));
    for (const p of ata.extracao.pendencias) {
      paras.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(p.texto),
            new TextRun({ text: ` — ${p.responsavel ?? 'sem responsável'}`, italics: true }),
            ...(p.prazo ? [new TextRun(` (${formatDateBR(p.prazo)})`)] : []),
          ],
        }),
      );
    }
  }
  if (ata.extracao.valores.length) {
    paras.push(new Paragraph({ text: 'Valores', heading: HeadingLevel.HEADING_2 }));
    for (const v of ata.extracao.valores) {
      const texto = v.unidade === 'R$' ? formatBRL(v.valor) : `${v.valor} ${v.unidade}`;
      paras.push(new Paragraph({ text: `${v.descricao} — ${texto}`, bullet: { level: 0 } }));
    }
  }

  const docxDoc = new Document({ sections: [{ children: paras }] });
  const buffer = await Packer.toBuffer(docxDoc);
  return new NextResponse(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="ata-${recordingId}.docx"`,
    },
  });
}
