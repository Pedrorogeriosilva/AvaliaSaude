import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv, isSupabaseConfigured } from './config';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith('/login');
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.');

  if (isPublicAsset) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    if (isLoginRoute) {
      return NextResponse.next({ request });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Configuração do Supabase incompleta.');
    return NextResponse.redirect(url);
  }

  const { url, anonKey } = getSupabaseEnv();
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url!, anonKey!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    if (user && isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/painel';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } catch {
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'Falha ao conectar com o Supabase.');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
