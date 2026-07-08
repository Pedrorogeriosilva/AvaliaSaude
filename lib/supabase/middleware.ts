import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from './config';

function redirectToLogin(request: NextRequest, message?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';

  if (message) {
    loginUrl.searchParams.set('error', message);
  }

  return NextResponse.redirect(loginUrl);
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith('/login');
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/brand') || pathname.includes('.');

  if (isPublicAsset) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    if (isLoginRoute) return NextResponse.next({ request });
    return redirectToLogin(request, 'Configuração do Supabase incompleta.');
  }

  if (!isLoginRoute && !hasSupabaseSessionCookie(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}
