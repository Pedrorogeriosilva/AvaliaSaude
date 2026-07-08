'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    redirect('/login?error=Informe o e-mail e a senha.');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect('/login?error=E-mail ou senha inválidos.');
    }
  } catch {
    redirect('/login?error=Não foi possível conectar ao Supabase.');
  }

  redirect('/painel');
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
  }

  redirect('/login');
}