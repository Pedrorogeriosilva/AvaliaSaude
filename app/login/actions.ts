'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  let target = '/painel';

  if (!email || !password) {
    target = '/login?error=Informe o e-mail e a senha.';
  } else {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        target = '/login?error=E-mail ou senha inválidos.';
      }
    } catch {
      target = '/login?error=Não foi possível conectar ao Supabase. Confira as variáveis de ambiente.';
    }
  }

  redirect(target);
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Mesmo que o Supabase falhe, a navegação volta para o login.
  }

  redirect('/login');
}
