import { NextResponse } from 'next/server';
import { DIAS_LIXEIRA, expurgarVencidas } from '@/lib/expurgo';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

export const maxDuration = 300;

/**
 * Cron diário (vercel.json): expurga o que está na lixeira há mais de 30 dias.
 * A Vercel chama com `Authorization: Bearer <CRON_SECRET>`; sem o segredo
 * configurado a rota fica desligada. Responde só contagens, nunca conteúdo.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: 'Cron desligado.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  if (!hasServiceRole()) return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });

  const res = await expurgarVencidas(createAdminClient(), DIAS_LIXEIRA);
  return NextResponse.json({ ok: true, ...res });
}
