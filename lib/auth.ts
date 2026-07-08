import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
} | null;

export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.status !== 'active') {
      return null;
    }

    return {
      id: profile.id,
      full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
      email: profile.email || user.email || null,
      role: profile.role || null,
      status: profile.status || null,
    };
  } catch {
    return null;
  }
});

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin' ? profile : null;
}
