import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Service role só existe no servidor (worker do pipeline). Ignora RLS. */
export function hasServiceRole(): boolean {
  return SUPABASE_URL.length > 0 && SERVICE_ROLE_KEY.length > 0;
}

export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
