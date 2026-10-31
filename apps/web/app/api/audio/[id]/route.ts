import { NextResponse } from 'next/server';
import { garantirAudioFinal } from '@/lib/audio-final';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 120;

/**
 * Áudio completo da gravação para o player: autoriza pela sessão (RLS), garante
 * o arquivo final (junta os blocos uma única vez) e redireciona para uma URL
 * assinada curta do Storage — que aceita Range, então o player arrasta e o
 * corpo não passa pela função (limite de 4,5 MB da Vercel).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ehUuid(id)) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // RLS decide o acesso (visibilidade/empresa).
  const { data: rec } = await supabase
    .from('recordings')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  try {
    if (hasServiceRole()) {
      const admin = createAdminClient();
      const final = await garantirAudioFinal(admin, id);
      if (!final) return NextResponse.json({ error: 'Sem áudio.' }, { status: 404 });
      const { data, error } = await admin.storage.from('audio').createSignedUrl(final.path, 3600);
      if (error || !data?.signedUrl) throw new Error('assinatura falhou');
      return NextResponse.redirect(data.signedUrl, { status: 302 });
    }
    // Modo só-código: primeiro bloco pela sessão.
    const { data: chunk } = await supabase
      .from('recording_chunks')
      .select('storage_path')
      .eq('recording_id', id)
      .order('index', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!chunk) return NextResponse.json({ error: 'Sem áudio.' }, { status: 404 });
    const { data } = await supabase.storage.from('audio').createSignedUrl(chunk.storage_path, 3600);
    if (!data?.signedUrl) throw new Error('assinatura falhou');
    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o áudio.' }, { status: 500 });
  }
}
