import { NextResponse, after } from 'next/server';
import { statusPorEventoRecall, verificarAssinaturaSvix } from '@talkin/core';
import { selectBotProvider } from '@/lib/bot';
import { ingerirGravacaoDoBot } from '@/lib/bot-ingest';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

export const maxDuration = 300;

type Evento = {
  event?: string;
  data?: { bot?: { id?: string; metadata?: Record<string, unknown> }; data?: { code?: string } };
};

/**
 * Webhook do Recall.ai (entregue via Svix). Atualiza o status do bot e, quando
 * ele sai da reunião, baixa o áudio e dispara o pipeline (em `after`, porque o
 * Svix dá 15 s para a resposta). Sem segredo configurado ou sem assinatura
 * válida, recusa — nunca aceita evento anônimo.
 */
export async function POST(request: Request) {
  const secret = process.env.RECALL_WEBHOOK_SECRET ?? '';
  if (!secret || !hasServiceRole()) {
    return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });
  }
  const corpo = await request.text();
  const ok = await verificarAssinaturaSvix({
    id: request.headers.get('svix-id') ?? request.headers.get('webhook-id'),
    timestamp: request.headers.get('svix-timestamp') ?? request.headers.get('webhook-timestamp'),
    signature: request.headers.get('svix-signature') ?? request.headers.get('webhook-signature'),
    corpo,
    secret,
  });
  if (!ok) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });

  let ev: Evento;
  try {
    ev = JSON.parse(corpo) as Evento;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const evento = ev.event ?? '';
  const providerBotId = ev.data?.bot?.id;
  if (!providerBotId || !/^[A-Za-z0-9_-]{1,100}$/.test(providerBotId)) {
    return NextResponse.json({ ok: true, ignorado: 'sem bot' });
  }

  const admin = createAdminClient();
  const { data: bot } = await admin
    .from('meeting_bots')
    .select(
      'id, organization_id, platform, meeting_url, provider_bot_id, recording_id, created_by, status',
    )
    .eq('provider_bot_id', providerBotId)
    .maybeSingle();
  if (!bot) return NextResponse.json({ ok: true, ignorado: 'bot desconhecido' });

  // Status: "saiu" (desligado pelo usuário) e "erro" não regridem para entrando/gravando.
  const novo = statusPorEventoRecall(evento);
  const final = bot.status === 'saiu' || bot.status === 'erro';
  if (novo && !(final && (novo === 'entrando' || novo === 'gravando'))) {
    await admin.from('meeting_bots').update({ status: novo }).eq('id', bot.id);
  }

  // Fim da reunião: ingere o áudio e processa depois de responder.
  if ((evento === 'bot.done' || evento === 'bot.call_ended') && !bot.recording_id) {
    const provider = selectBotProvider();
    if (provider) {
      after(async () => {
        try {
          await ingerirGravacaoDoBot(admin, provider, {
            id: bot.id,
            organization_id: bot.organization_id,
            platform: bot.platform,
            meeting_url: bot.meeting_url,
            provider_bot_id: providerBotId,
            recording_id: bot.recording_id,
            created_by: bot.created_by,
          });
        } catch {
          // Falha registrada na gravação (status erro); o próximo webhook (bot.done) tenta de novo.
        }
      });
    }
  }
  return NextResponse.json({ ok: true });
}
