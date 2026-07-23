import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login?error=Faça login para continuar.');
  }

  let cityLabel: string | null = null;
  if (!profile.is_master && profile.city_id) {
    const supabase = await createClient();
    const { data: city } = await supabase
      .from('cities')
      .select('name, state_uf')
      .eq('id', profile.city_id)
      .maybeSingle();
    if (city) cityLabel = `${city.name} / ${city.state_uf}`;
  }

  return <AppShell profile={{ ...profile, city_label: cityLabel }}>{children}</AppShell>;
}
