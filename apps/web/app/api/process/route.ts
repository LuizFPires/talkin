import { NextResponse } from 'next/server';
import { processRecording, selectProviders } from '@talkin/pipeline';
import { createSupabasePorts } from '@/lib/pipeline-ports';
import { hasServiceRole } from '@/lib/supabase/admin';

export const maxDuration = 300;

/**
 * Entrada do worker do pipeline. POST { recordingId }.
 * Em produção isto é disparado por uma fila; aqui é chamado após o upload.
 */
export async function POST(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: 'Supabase service role não configurado (modo só-código).' },
      { status: 503 },
    );
  }

  const { recordingId } = (await request.json()) as { recordingId?: string };
  if (!recordingId) {
    return NextResponse.json({ error: 'recordingId obrigatório' }, { status: 400 });
  }

  const ports = createSupabasePorts();
  const providers = selectProviders();

  try {
    await processRecording(recordingId, ports, providers);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
