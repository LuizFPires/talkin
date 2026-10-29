import { createClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/env';

export type SessionInfo = {
  userId: string;
  email: string;
  organizationId: string | null;
  role: string | null;
};

/** Usuário logado + empresa/papel (null se não houver sessão ou Supabase não conectado). */
export async function getSession(): Promise<SessionInfo | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? '',
    organizationId: membership?.organization_id ?? null,
    role: membership?.role ?? null,
  };
}
