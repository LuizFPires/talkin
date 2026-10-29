import { buildAtaHtml } from '@talkin/pdf/html';
import { AtaContent, type PdfTemplate } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

type Shared = {
  title: string;
  date: string;
  source?: string;
  content: unknown;
  org: {
    nome_fantasia: string;
    accent_color: string | null;
    site: string | null;
    pdf_template: PdfTemplate;
  };
};

export default async function CompartilharPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const indisponivel = (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#030707',
        color: '#98989d',
      }}
    >
      <p>Link inválido ou expirado.</p>
    </main>
  );
  if (!isSupabaseConfigured()) return indisponivel;

  const supabase = await createClient();
  const { data } = await supabase.rpc('get_shared_ata', { p_token: token });
  const shared = data as Shared | null;
  if (!shared) return indisponivel;

  const ata = AtaContent.safeParse(shared.content);
  if (!ata.success) return indisponivel;

  const html = buildAtaHtml({
    org: {
      nome_fantasia: shared.org.nome_fantasia,
      accent_color: shared.org.accent_color,
      site: shared.org.site,
    },
    recording: { title: shared.title, date: shared.date, source: shared.source, revisada: true },
    ata: ata.data,
    template: shared.org.pdf_template,
  });

  return (
    <main style={{ minHeight: '100dvh', background: '#f2f4f4' }}>
      <iframe
        title="Ata compartilhada"
        srcDoc={html}
        sandbox=""
        style={{ width: '100%', height: '100dvh', border: 'none' }}
      />
    </main>
  );
}
