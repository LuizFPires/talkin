import { NextResponse } from 'next/server';
import { processRecording, selectProviders } from '@talkin/pipeline';
import { createSupabasePorts } from '@/lib/pipeline-ports';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

/**
 * Entrada do worker do pipeline. POST { recordingId }.
 * Autoriza pelo usuário logado (RLS) antes de rodar com service role,
 * para que ninguém dispare o processamento de gravação alheia (IDOR).
 */
export async function POST(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });
  }

  const { recordingId } = (await request.json().catch(() => ({}))) as { recordingId?: string };
  if (!recordingId || !/^[0-9a-f-]{36}$/i.test(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  // Autenticação + autorização pela sessão do usuário (RLS).
  const user = await createClient();
  const {
    data: { user: authUser },
  } = await user.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: canModify } = await user.rpc('can_modify_recording', { rec: recordingId });
  if (!canModify) {
    return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  }

  // Claim atômico (compare-and-set): só um worker processa de cada vez.
  // Se o status não estiver processável, nenhuma linha volta → 409.
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from('recordings')
    .update({ status: 'transcrevendo' })
    .eq('id', recordingId)
    .in('status', ['enviando', 'erro'])
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json(
      { error: 'Gravação não está pronta para processar.' },
      { status: 409 },
    );
  }

  try {
    await processRecording(recordingId, createSupabasePorts(), selectProviders());
    return NextResponse.json({ ok: true });
  } catch {
    // Não vaza detalhe interno do worker.
    return NextResponse.json({ error: 'Falha no processamento.' }, { status: 500 });
  }
}
