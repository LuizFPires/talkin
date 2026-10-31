import { NextResponse } from 'next/server';
import { regenerateSummary, selectProviders } from '@talkin/pipeline';
import { createSupabasePorts } from '@/lib/pipeline-ports';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 120;

/**
 * Gera a ata a partir da transcrição JÁ salva (ao vivo), sem re-transcrever nem
 * tocar em áudio/ffmpeg. POST { recordingId }. Autoriza pela sessão (RLS) e faz
 * claim atômico do status antes de rodar com service role.
 */
export async function POST(request: Request) {
  if (!hasServiceRole()) return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });

  const { recordingId } = (await request.json().catch(() => ({}))) as { recordingId?: string };
  if (!ehUuid(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const user = await createClient();
  const {
    data: { user: authUser },
  } = await user.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: canModify } = await user.rpc('can_modify_recording', { rec: recordingId });
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  // Claim atômico: só a partir de estados de captura/erro (a transcrição ao vivo já existe).
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from('recordings')
    .update({ status: 'resumindo' })
    .eq('id', recordingId)
    .in('status', ['gravando', 'enviando', 'erro'])
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json(
      { error: 'Gravação não está pronta para gerar a ata.' },
      { status: 409 },
    );
  }

  try {
    await regenerateSummary(recordingId, createSupabasePorts(), selectProviders());
    return NextResponse.json({ ok: true });
  } catch {
    // regenerateSummary já marca status 'erro' e registra o job; não vaza detalhe.
    return NextResponse.json({ error: 'Falha ao gerar a ata.' }, { status: 500 });
  }
}
