import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Modo só-código: sem Supabase conectado, mostra o shell com e-mail de exemplo.
  if (!isSupabaseConfigured()) {
    return <AppShell email="demo@local">{children}</AppShell>;
  }

  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.organizationId) redirect('/comecar');

  return <AppShell email={session.email}>{children}</AppShell>;
}
