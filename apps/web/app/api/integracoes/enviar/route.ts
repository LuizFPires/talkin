import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AtaContent, buildWebhookPayload } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

/** Rejeita destinos que não sejam https público (anti-SSRF a redes internas). */
function urlSeguro(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return false;
  if (h === '::1' || h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')) return false;
  return true;
}

/** Envia decisões/pendências ao ioo via webhook assinado. Só ata revisada (SPEC 21). */
export async function POST(request: Request) {
  const { recordingId } = (await request.json().catch(() => ({}))) as { recordingId?: string };
  if (!recordingId || !/^[0-9a-f-]{36}$/i.test(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: rec } = await supabase
    .from('recordings')
    .select('id, title, organization_id')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  const { data: summary } = await supabase
    .from('summaries')
    .select('content, status')
    .eq('recording_id', recordingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (summary?.status !== 'revisada') {
    return NextResponse.json({ error: 'Só ata revisada pode ser enviada.' }, { status: 409 });
  }
  const parsed = AtaContent.safeParse(summary.content);
  if (!parsed.success) return NextResponse.json({ error: 'Ata inválida.' }, { status: 409 });

  const { data: integ } = await supabase
    .from('integrations')
    .select('ioo_webhook_url, webhook_secret')
    .eq('organization_id', rec.organization_id)
    .maybeSingle();
  const url = integ?.ioo_webhook_url as string | undefined;
  if (!url) return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 400 });
  if (!urlSeguro(url)) {
    return NextResponse.json(
      { error: 'URL de webhook inválida (use https público).' },
      { status: 400 },
    );
  }

  const payload = buildWebhookPayload(rec.id, rec.title ?? '', parsed.data, true);
  const body = JSON.stringify(payload);
  const secret = (integ?.webhook_secret as string | undefined) ?? '';
  const assinatura = secret ? createHmac('sha256', secret).update(body).digest('hex') : '';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(assinatura ? { 'x-talkin-signature': assinatura } : {}),
      },
      body,
    });
    if (!res.ok)
      return NextResponse.json({ error: `Destino respondeu ${res.status}.` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao enviar ao destino.' }, { status: 502 });
  }
}
