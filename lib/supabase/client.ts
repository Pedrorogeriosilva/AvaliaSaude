import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './config';

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    throw new Error('Configuração do Supabase incompleta.');
  }

  return createBrowserClient(url, anonKey);
}
