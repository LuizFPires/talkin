import { createHmac } from 'node:crypto';
import { lookup as lookupPromise } from 'node:dns/promises';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { Agent, fetch as httpFetch } from 'undici';
import ipaddr from 'ipaddr.js';
import { NextResponse } from 'next/server';
import { AtaContent, buildWebhookPayload } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 30;

/** Um IP só é aceito se for unicast público (bloqueia privado/loopback/CGNAT/ULA/etc.). */
function ipPublico(ip: string): boolean {
  let p: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    p = ipaddr.parse(ip);
  } catch {
    return false;
  }
  if (p.kind() === 'ipv6') {
    const v6 = p as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return ipPublico(v6.toIPv4Address().toString());
  }
  return p.range() === 'unicast';
}

/** Destino do webhook: https, host público e sem redirect para rede interna. */
async function destinoSeguro(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  let host = u.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal'))
    return false;
  try {
    const addrs = await lookupPromise(host, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => ipPublico(a.address));
  } catch {
    return false;
  }
}

/**
 * Dispatcher que PINA a conexão ao IP validado: o lookup usado pela conexão
 * real revalida cada endereço com ipPublico, fechando a janela de DNS rebinding.
 */
type LookupCb = (err: Error | null, address: string | LookupAddress[], family?: number) => void;
const safeAgent = new Agent({
  connect: {
    lookup: (hostname: string, options: { all?: boolean }, callback: LookupCb) => {
      dnsLookup(
        hostname,
        { ...options, all: true, verbatim: true },
        (err: Error | null, addresses: { address: string; family: number }[]) => {
          if (err) return callback(err, '', 0);
          if (addresses.length === 0 || !addresses.every((a) => ipPublico(a.address))) {
            return callback(new Error('IP não permitido'), '', 0);
          }
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0]!.address, addresses[0]!.family);
        },
      );
    },
  },
});

/** Envia decisões/pendências ao ioo via webhook assinado. Só ata revisada (SPEC 21). */
export async function POST(request: Request) {
  if (!hasServiceRole()) return NextResponse.json({ error: 'Indisponível.' }, { status: 503 });

  const { recordingId } = (await request.json().catch(() => ({}))) as { recordingId?: string };
  if (!ehUuid(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Só quem pode modificar a gravação dispara o envio (dono/admin).
  const { data: canModify } = await supabase.rpc('can_modify_recording', { rec: recordingId });
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

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
    .select('ioo_webhook_url')
    .eq('organization_id', rec.organization_id)
    .maybeSingle();
  const url = integ?.ioo_webhook_url as string | undefined;
  if (!url) return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 400 });
  if (!(await destinoSeguro(url))) {
    return NextResponse.json(
      { error: 'URL de webhook inválida (use https público).' },
      { status: 400 },
    );
  }

  // Segredo lido só no servidor (service role), nunca exposto a membros.
  const admin = createAdminClient();
  const { data: sec } = await admin
    .from('integration_secrets')
    .select('webhook_secret')
    .eq('organization_id', rec.organization_id)
    .maybeSingle();
  const secret = (sec?.webhook_secret as string | undefined) ?? '';
  // Nunca envia payload de reunião sem assinatura: exige o segredo configurado.
  if (!secret) {
    return NextResponse.json(
      { error: 'Configure o segredo do webhook antes de enviar (assinatura obrigatória).' },
      { status: 400 },
    );
  }

  const payload = buildWebhookPayload(rec.id, rec.title ?? '', parsed.data, true);
  const body = JSON.stringify(payload);
  const assinatura = createHmac('sha256', secret).update(body).digest('hex');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000); // timeout de 10 s
  try {
    const res = await httpFetch(url, {
      method: 'POST',
      redirect: 'manual', // não seguir redirect (anti-SSRF)
      signal: ac.signal,
      dispatcher: safeAgent, // pina a conexão ao IP validado (anti DNS rebinding)
      headers: {
        'content-type': 'application/json',
        'x-talkin-signature': assinatura,
      },
      body,
    });
    // 3xx (redirect) ou erro → falha genérica, sem ecoar o status do destino.
    if (res.status >= 300) {
      return NextResponse.json({ error: 'O destino não aceitou o envio.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao enviar ao destino.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
