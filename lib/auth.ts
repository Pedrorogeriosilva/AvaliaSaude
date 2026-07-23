import 'server-only';
import { cache } from 'react';
import { measureAsync } from '@/lib/performance';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types';
import { APP_ROLES } from '@/lib/validation';

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  status: string | null;
  is_master: boolean;
  city_id: string | null;
} | null;

const getCurrentUser = cache(async () => {
  try {
    return await measureAsync('getCurrentUser', async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      return user ?? null;
    });
  } catch {
    return null;
  }
});

export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  try {
    return await measureAsync('getCurrentProfile', async () => {
      const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

      if (!user) return null;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, is_master, city_id')
        .eq('id', user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        profile.status !== 'active' ||
        !APP_ROLES.includes(profile.role as AppRole)
      ) {
        return null;
      }

      return {
        id: profile.id,
        full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
        email: profile.email || user.email || null,
        role: profile.role as AppRole,
        status: profile.status || null,
        is_master: Boolean(profile.is_master),
        city_id: profile.city_id ?? null,
      };
    });
  } catch {
    return null;
  }
});

export async function requireActiveProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Seu acesso expirou ou não está liberado para este sistema.');
  }
  return profile;
}

function assertRole(profile: Exclude<CurrentProfile, null>, allowedRoles: AppRole[], message: string) {
  // O master faz tudo em qualquer cidade, então nunca esbarra no papel.
  if (profile.is_master) return profile;
  if (!allowedRoles.includes(profile.role)) {
    throw new Error(message);
  }
  return profile;
}

export async function requireMaster() {
  const profile = await requireActiveProfile();
  if (!profile.is_master) {
    throw new Error('Apenas o usuário master pode realizar esta ação.');
  }
  return profile;
}

export async function requireAdmin() {
  const profile = await requireActiveProfile();
  return assertRole(profile, ['admin'], 'Apenas administradores podem realizar esta ação.');
}

export async function requireAdminOrOperator() {
  const profile = await requireActiveProfile();
  return assertRole(profile, ['admin', 'operator'], 'Seu perfil não tem permissão para realizar esta ação.');
}

export async function assertCanCreateEvaluation() {
  const profile = await requireAdminOrOperator();
  return profile;
}

export async function assertCanManagePatients() {
  const profile = await requireAdminOrOperator();
  return profile;
}

export async function assertCanDeletePatients() {
  return requireAdmin();
}

export async function assertCanManageUnits() {
  return requireAdmin();
}

export async function assertCanManageProfessionals() {
  return requireAdmin();
}

export async function assertCanManageUsers() {
  return requireMaster();
}

export async function assertCanManageCities() {
  return requireMaster();
}
