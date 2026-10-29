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

  // RLS garante que só um bot da empresa do usuário é visível/alterável.
  const { data: bot } = await supabase
    .from('meeting_bots')
    .select('id, provider_bot_id')
    .eq('id', botId)
    .maybeSingle();
  if (!bot) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  if (bot.provider_bot_id) {
    try {
      await selectBotProvider().stopBot(bot.provider_bot_id as string);
    } catch {
      // segue para marcar como saiu mesmo se o provedor falhar
    }
  }
  await supabase.from('meeting_bots').update({ status: 'saiu' }).eq('id', botId);
  return NextResponse.json({ ok: true });
}
