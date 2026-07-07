import Link from 'next/link';
import { Activity, BarChart3, ClipboardCheck, Database, LogOut, Trophy } from 'lucide-react';
import { logoutAction } from '@/app/login/actions';

const navItems = [
  { href: '/painel', label: 'Painel', icon: BarChart3 },
  { href: '/avalie', label: 'Avalie', icon: ClipboardCheck },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/cadastros', label: 'Cadastros', icon: Database },
];

type Props = {
  children: React.ReactNode;
  profile: {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export function AppShell({ children, profile }: Props) {
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/painel" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white">
              <Activity size={23} />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">Avalia Saúde</div>
              <div className="text-xs text-slate-500">Porto Alegre do Norte - MT</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="text-sm font-semibold text-slate-900">{profile?.full_name || 'Usuário'}</div>
              <div className="text-xs text-slate-500">{profile?.role || 'perfil'} · {profile?.email}</div>
            </div>
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <LogOut size={16} />
                Sair
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-2 md:hidden">
          <nav className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
