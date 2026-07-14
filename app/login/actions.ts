'use server';

import { redirect } from 'next/navigation';
import { lockUserManagementGate } from '@/lib/admin-gate';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/validation';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase().slice(0, 254);
  const password = String(formData.get('password') || '');
  let target = '/painel';

  if (!email || !password || !isValidEmail(email)) {
    target = '/login?error=Informe o e-mail e a senha.';
  } else {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        target = '/login?error=E-mail ou senha inválidos.';
      } else {
        const profile = await getCurrentProfile();
        if (!profile) {
          await supabase.auth.signOut();
          target = '/login?error=Seu acesso não está liberado para este sistema.';
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
