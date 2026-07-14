import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from './config';

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function applySecurityHeaders(response: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

function redirectToLogin(request: NextRequest, message?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';

  if (message) {
    loginUrl.searchParams.set('error', message);
  }

  const response = NextResponse.redirect(loginUrl);
  applySecurityHeaders(response);
  return response;
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith('/login');
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/brand') || pathname.includes('.');

  if (isPublicAsset) {
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    return response;
  }

  if (!isSupabaseConfigured()) {
    if (isLoginRoute) {
      const response = NextResponse.next({ request });
      applySecurityHeaders(response);
      return response;
    }
    return redirectToLogin(request, 'Não foi possível validar o acesso no momento.');
  }

  if (!isLoginRoute && !hasSupabaseSessionCookie(request)) {
    return redirectToLogin(request);
  }

  const response = NextResponse.next({ request });
  applySecurityHeaders(response);
  return response;
}
