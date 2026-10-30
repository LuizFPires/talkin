import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Sem Supabase conectado (modo só-código): segue sem renovar sessão.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Renova a sessão (não remover: refaz o token quando expira).
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Não roda em /api (as rotas validam a sessão sozinhas) nem em estáticos —
  // evita um getUser() de rede a cada chamada de API.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
