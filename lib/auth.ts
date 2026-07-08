import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

type CurrentProfile = {
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const role = (user.app_metadata?.role as string | undefined) || (user.user_metadata?.role as string | undefined) || null;

    return {
      full_name: (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'Usuário',
      email: user.email,
      role,
    };
  } catch {
    return null;
  }
});