import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv, isSupabaseConfigured } from './config';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith('/login');
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.');

  if (isPublicAsset) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    if (isLoginRoute) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'Configuração do Supabase incompleta.');
    return NextResponse.redirect(loginUrl);
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
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isLoginRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && isLoginRoute) {
      const painelUrl = request.nextUrl.clone();
      painelUrl.pathname = '/painel';
      painelUrl.search = '';
      return NextResponse.redirect(painelUrl);
    }
  } catch {
    if (!isLoginRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('error', 'Falha ao conectar com o Supabase.');
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}