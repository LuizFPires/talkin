import { NextResponse } from 'next/server';
import { expurgarGravacao } from '@/lib/expurgo';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 60;

/**
 * Exclui definitivamente uma gravação que está na lixeira (SPEC 24).
 * Autoriza pela sessão (can_modify_recording: dono ou admin) e exige que a
 * gravação já esteja excluída (deleted_at); o apagar de verdade roda com
 * service role porque o cliente não pode mexer no bucket de outros arquivos.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasServiceRole()) return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });
  const { id } = await ctx.params;
  if (!ehUuid(id)) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: canModify } = await supabase.rpc('can_modify_recording', { rec: id });
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  const { data: rec } = await supabase
    .from('recordings')
    .select('deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!rec?.deleted_at) {
    return NextResponse.json({ error: 'A gravação não está na lixeira.' }, { status: 409 });
  }

  const res = await expurgarGravacao(createAdminClient(), id);
  if (!res.ok) {
    return NextResponse.json({ error: 'Não foi possível excluir agora.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
