import Link from 'next/link';
import { Building2, MapPin, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { getCurrentProfile } from '@/lib/auth';

const cards = [
  { href: '/cadastros/cidades', title: 'Cidades', icon: MapPin, masterOnly: true },
  { href: '/cadastros/pacientes', title: 'Pacientes', icon: Users, masterOnly: false },
  { href: '/cadastros/unidades', title: 'Unidades de saúde', icon: Building2, masterOnly: false },
  { href: '/cadastros/profissionais', title: 'Profissionais', icon: Stethoscope, masterOnly: false },
  { href: '/cadastros/usuarios', title: 'Usuários do sistema', icon: ShieldCheck, masterOnly: true },
];

export default async function CadastrosPage() {
  const currentProfile = await getCurrentProfile();
  const isMaster = Boolean(currentProfile?.is_master);
  const visibleCards = isMaster ? cards : cards.filter((card) => !card.masterOnly);

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
