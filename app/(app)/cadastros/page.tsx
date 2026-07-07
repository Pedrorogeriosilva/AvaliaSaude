import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Users, Building2, Stethoscope, ShieldCheck } from 'lucide-react';

const cards = [
  {
    href: '/cadastros/pacientes',
    title: 'Pacientes',
    description: 'Cadastro de pacientes avaliados ou registrados previamente.',
    icon: Users,
  },
  {
    href: '/cadastros/unidades',
    title: 'Unidades de saúde',
    description: 'PSFs, hospital, endereço, status e informações administrativas.',
    icon: Building2,
  },
  {
    href: '/cadastros/profissionais',
    title: 'Profissionais',
    description: 'Funcionários vinculados às unidades, cargo e horário de trabalho.',
    icon: Stethoscope,
  },
  {
    href: '/cadastros/usuarios',
    title: 'Usuários do sistema',
    description: 'Perfis de administrador, operador e leitura.',
    icon: ShieldCheck,
  },
];

export default function CadastrosPage() {
  return (
    <>
      <PageHeader
        title="Cadastros"
        description="Gerencie os dados principais utilizados nas avaliações e indicadores do sistema."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="rounded-xl border border-slate-200 bg-white p-6 gov-shadow hover:border-blue-300">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
