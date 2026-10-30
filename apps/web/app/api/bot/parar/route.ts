import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { selectBotProvider } from '@/lib/bot';

export const maxDuration = 30;

/** Desliga o bot numa reunião (liga/desliga por reunião, SPEC 22). POST { botId }. */
export async function POST(request: Request) {
  const { botId } = (await request.json().catch(() => ({}))) as { botId?: string };
  if (!botId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(botId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Marca como saiu: a RLS de update exige gestor/admin da empresa do bot
  // (controle de custo). 0 linhas = sem permissão ou bot inexistente.
  const { data: parado } = await supabase
    .from('meeting_bots')
    .update({ status: 'saiu' })
    .eq('id', botId)
    .select('id, provider_bot_id')
    .maybeSingle();
  if (!parado) {
    return NextResponse.json({ error: 'Sem permissão ou bot inexistente.' }, { status: 403 });
  }

  if (parado.provider_bot_id) {
    try {
      await selectBotProvider().stopBot(parado.provider_bot_id as string);
    } catch {
      // provedor falhou, mas o bot já consta como encerrado
    }
  }
  return NextResponse.json({ ok: true });
}
