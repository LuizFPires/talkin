import { NextResponse } from 'next/server';
import { regenerateSummary, selectProviders } from '@talkin/pipeline';
import { createSupabasePorts } from '@/lib/pipeline-ports';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

/** Regenera a ata (troca de modelo, SPEC 9). POST { recordingId, templateId? }. */
export async function POST(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });
  }
  const { recordingId, templateId } = (await request.json().catch(() => ({}))) as {
    recordingId?: string;
    templateId?: string | null;
  };
  if (!recordingId || !/^[0-9a-f-]{36}$/i.test(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const user = await createClient();
  const {
    data: { user: authUser },
  } = await user.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: canModify } = await user.rpc('can_modify_recording', { rec: recordingId });
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  // Valida o modelo ANTES do claim: precisa ser visível ao usuário (global ou da
  // mesma empresa, pela RLS de templates). Assim a troca pós-claim não falha por acesso.
  if (templateId) {
    const { data: tpl } = await user
      .from('templates')
      .select('id')
      .eq('id', templateId)
      .maybeSingle();
    if (!tpl) return NextResponse.json({ error: 'Modelo inválido.' }, { status: 400 });
  }

  // Claim atômico: só regenera a partir de um estado final (pronto/erro).
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from('recordings')
    .update({ status: 'resumindo' })
    .eq('id', recordingId)
    .in('status', ['pronto', 'erro'])
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: 'A ata ainda está sendo processada.' }, { status: 409 });
  }

  // Troca o modelo depois do claim (evita modelo novo com ata antiga).
  if (templateId !== undefined) {
    const { error } = await user
      .from('recordings')
      .update({ template_id: templateId })
      .eq('id', recordingId);
    if (error) {
      // Rollback condicional a um estado final (não clobbera mudança concorrente).
      await admin
        .from('recordings')
        .update({ status: 'erro' })
        .eq('id', recordingId)
        .eq('status', 'resumindo');
      return NextResponse.json({ error: 'Não foi possível trocar o modelo.' }, { status: 400 });
    }
  }

  try {
    await regenerateSummary(recordingId, createSupabasePorts(), selectProviders());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao regenerar.' }, { status: 500 });
  }
}
