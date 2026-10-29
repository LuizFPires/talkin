'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

/** Cria uma gravação vazia (aparece na biblioteca com status). */
export async function criarGravacaoVazia() {
  const session = await getSession();
  if (!session?.organizationId) return;

  const supabase = await createClient();
  await supabase.from('recordings').insert({
    organization_id: session.organizationId,
    created_by: session.userId,
    title: '',
    source: 'outro',
  });

  revalidatePath('/biblioteca');
}
