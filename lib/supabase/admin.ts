import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './config';

export function isAdminClientConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Configuração administrativa incompleta. Configure SUPABASE_SERVICE_ROLE_KEY somente no servidor.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
