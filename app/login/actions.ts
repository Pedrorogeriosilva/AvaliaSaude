'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { lockUserManagementGate } from '@/lib/admin-gate';
import { getCurrentProfile } from '@/lib/auth';
import { clearFailures, peekRateLimit, registerFailure, type RateLimitOptions } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/validation';

const LOGIN_RATE_LIMIT: RateLimitOptions = {
  limit: 8,
  windowSeconds: 10 * 60,
  blockSeconds: 15 * 60,
};

/**
 * Chaveia por IP + e-mail para que ninguém consiga bloquear a conta de outra
 * pessoa apenas disparando tentativas erradas com o e-mail dela.
 */
async function getLoginRateLimitKey(email: string) {
  const headerStore = await headers();
  const forwardedFor = headerStore.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0]?.trim() || headerStore.get('x-real-ip') || 'unknown';

  return `login:${createHash('sha256').update(`${ip}|${email}`).digest('hex')}`;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase().slice(0, 254);
  const password = String(formData.get('password') || '');
  let target = '/painel';

  if (!email || !password || !isValidEmail(email)) {
    target = '/login?error=Informe o e-mail e a senha.';
  } else {
    const rateLimitKey = await getLoginRateLimitKey(email);
    const cooldown = peekRateLimit(rateLimitKey);

    if (cooldown.blocked) {
      const minutes = Math.max(1, Math.ceil(cooldown.retryAfterSeconds / 60));
      redirect(`/login?error=${encodeURIComponent(`Muitas tentativas de acesso. Aguarde ${minutes} minuto(s) e tente novamente.`)}`);
    }

    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        registerFailure(rateLimitKey, LOGIN_RATE_LIMIT);
        target = '/login?error=E-mail ou senha inválidos.';
      } else {
        const profile = await getCurrentProfile();
        if (!profile) {
          await supabase.auth.signOut();
          registerFailure(rateLimitKey, LOGIN_RATE_LIMIT);
          target = '/login?error=Seu acesso não está liberado para este sistema.';
        } else {
          clearFailures(rateLimitKey);
        }
      }
    } catch {
      target = '/login?error=Não foi possível entrar no sistema agora. Tente novamente.';
    }
  }

  redirect(target);
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await lockUserManagementGate();
  } catch {
    // Mesmo que o Supabase falhe, a navegação volta para o login.
  }

  redirect('/login');
}
