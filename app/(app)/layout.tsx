import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentProfile } from '@/lib/auth';

export const runtime = 'nodejs';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login?error=Faça login para continuar.');
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
