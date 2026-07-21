import Link from 'next/link';
import { Building2, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { getCurrentProfile } from '@/lib/auth';

const cards = [
  { href: '/cadastros/pacientes', title: 'Pacientes', icon: Users },
  { href: '/cadastros/unidades', title: 'Unidades de saúde', icon: Building2 },
  { href: '/cadastros/profissionais', title: 'Profissionais', icon: Stethoscope },
  { href: '/cadastros/usuarios', title: 'Usuários do sistema', icon: ShieldCheck },
];

export default async function CadastrosPage() {
  const currentProfile = await getCurrentProfile();
  const visibleCards = currentProfile?.role === 'admin' ? cards : cards.filter((card) => card.href !== '/cadastros/usuarios');

  return (
    <>
      <PageHeader title="Cadastros" />

      <div className="grid gap-5 md:grid-cols-2">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:bg-slate-50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
            </Link>
          );
        })}
      </div>
    </>
  );
}
