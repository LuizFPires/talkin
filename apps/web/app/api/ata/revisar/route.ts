import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AtaContent,
  EdicaoBloco,
  aplicarEdicao,
  chavesComConteudo,
  marcarConferida,
} from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 30;

const Pedido = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('editar'), recordingId: z.string(), edicao: EdicaoBloco }),
  z.object({
    acao: z.literal('conferir'),
    recordingId: z.string(),
    chave: z.string().min(1),
    ok: z.boolean(),
  }),
  z.object({ acao: z.literal('concluir'), recordingId: z.string() }),
]);

/**
 * Revisão guiada da ata (SPEC 12). Tudo pela sessão do usuário (RLS: só quem pode
 * modificar a gravação). O conteúdo editado é validado pelo schema do bloco antes
 * de salvar; `concluir` marca a ata como Revisada (libera saídas e webhook).
 */
export async function POST(request: Request) {
  const parsed = Pedido.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !ehUuid(parsed.data.recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
  const pedido = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: summary } = await supabase
    .from('summaries')
    .select('id, status, content')
    .eq('recording_id', pedido.recordingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!summary) return NextResponse.json({ error: 'Ata não encontrada.' }, { status: 404 });

  if (pedido.acao === 'concluir') {
    // Concluir confere o que faltava e marca a ata como Revisada.
    const atualC = AtaContent.safeParse(summary.content);
    const conteudo = atualC.success
      ? {
          ...atualC.data,
          revisao: { ...atualC.data.revisao, conferidas: chavesComConteudo(atualC.data) },
        }
      : undefined;
    const { data, error } = await supabase
      .from('summaries')
      .update(conteudo ? { status: 'revisada', content: conteudo } : { status: 'revisada' })
      .eq('id', summary.id)
      .select('id');
    if (error || !data?.length) {
      return NextResponse.json(
        { error: 'Sem permissão para concluir a revisão.' },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, status: 'revisada' });
  }

  const atual = AtaContent.safeParse(summary.content);
  if (!atual.success) return NextResponse.json({ error: 'Ata inválida.' }, { status: 409 });

  let proxima: AtaContent;
  try {
    proxima =
      pedido.acao === 'editar'
        ? aplicarEdicao(atual.data, pedido.edicao)
        : marcarConferida(atual.data, pedido.chave, pedido.ok);
  } catch {
    return NextResponse.json({ error: 'Bloco inexistente.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('summaries')
    .update({ content: proxima })
    .eq('id', summary.id)
    .select('id');
  if (error || !data?.length) {
    return NextResponse.json({ error: 'Sem permissão para editar a ata.' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, revisao: proxima.revisao });
}
