import Link from 'next/link';
import { logoutAction } from '@/app/login/actions';
import { SiteLogo } from '@/components/ui/site-logo';
import { MainNav, type NavItem } from './main-nav';

const navItems: NavItem[] = [
  { href: '/painel', label: 'Painel' },
  { href: '/avalie', label: 'Avalie' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/cadastros', label: 'Cadastros' },
];

type Props = {
  children: React.ReactNode;
  profile: {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Leitura',
};

export function AppShell({ children, profile }: Props) {
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuário';
  const role = profile?.role ? roleLabel[profile.role] || profile.role : 'Perfil';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:gap-4 md:px-6 md:py-3">
          <Link href="/painel" className="shrink-0" aria-label="Ir para o painel">
            <SiteLogo size="md" priority className="w-[124px] md:w-[206px]" />
          </Link>

          <MainNav items={navItems} />

          <div className="flex items-center gap-3">
            <div className="hidden text-right lg:block">
              <div className="max-w-[220px] truncate text-sm font-semibold text-slate-900">{displayName}</div>
              <div className="max-w-[220px] truncate text-xs text-slate-500">{role} · {profile?.email}</div>
            </div>
            <form action={logoutAction}>
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Sair
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-2 pb-1.5 pt-1 md:hidden">
          <MainNav items={navItems} variant="mobile" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">{children}</main>
    </div>
  );
}
