import { NextResponse } from 'next/server';
import { estimarCustoBotCents, plataformaPorUrl } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { BOT_CENTS_PER_HOUR, selectBotProvider } from '@/lib/bot';

export const maxDuration = 30;

/** Agenda o bot para entrar numa reunião (SPEC 22). POST { meetingUrl }. */
export async function POST(request: Request) {
  if (!hasServiceRole()) return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });

  const { meetingUrl } = (await request.json().catch(() => ({}))) as { meetingUrl?: string };
  const plataforma = meetingUrl ? plataformaPorUrl(meetingUrl) : null;
  if (!meetingUrl || !plataforma) {
    return NextResponse.json(
      { error: 'URL de reunião inválida (Meet, Teams ou Zoom).' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const { data: m } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const org = m?.organization_id as string | undefined;
  if (!org) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 });

  const custoHoraCents = estimarCustoBotCents(60, BOT_CENTS_PER_HOUR);

  // Campos de servidor (custo/status/provider_bot_id) gravados via service role.
  const admin = createAdminClient();
  const { data: bot, error } = await admin
    .from('meeting_bots')
    .insert({
      organization_id: org,
      platform: plataforma,
      meeting_url: meetingUrl,
      created_by: user.id,
      cost_cents: custoHoraCents,
      scheduled_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !bot)
    return NextResponse.json({ error: 'Não foi possível agendar.' }, { status: 400 });

  try {
    const r = await selectBotProvider().scheduleBot({ meetingUrl, platform: plataforma });
    await admin
      .from('meeting_bots')
      .update({ provider_bot_id: r.providerBotId, status: r.status })
      .eq('id', bot.id);
    return NextResponse.json({ ok: true, botId: bot.id, custoHoraCents });
  } catch {
    // Bot não rodou: não deixa custo residual inflando os relatórios.
    await admin.from('meeting_bots').update({ status: 'erro', cost_cents: 0 }).eq('id', bot.id);
    return NextResponse.json({ error: 'Falha ao acionar o bot.' }, { status: 502 });
  }
}
