import { LockKeyhole } from 'lucide-react';
import { SiteLogo } from '@/components/ui/site-logo';
import { loginAction } from './actions';

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-slate-200 bg-white p-8 md:border-b-0 md:border-r md:p-10">
          <SiteLogo size="lg" priority />
          <div className="mt-8 inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
            Sistema Municipal de Avaliação
          </div>
          <p className="mt-6 max-w-lg text-sm leading-7 text-slate-600">
            Plataforma administrativa para acompanhamento de atendimentos, avaliações,
            indicadores de satisfação e desempenho das unidades de saúde do município.
          </p>
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Acesso restrito a administradores, operadores e usuários autorizados pela gestão municipal.
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-7">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <LockKeyhole size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-slate-500">Informe o e-mail e a senha cadastrados no Supabase Auth.</p>
          </div>

          {params.error ? (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </div>
          ) : null}

          <form action={loginAction} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">E-mail</span>
              <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600" type="email" name="email" placeholder="admin@seudominio.com" required />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Senha</span>
              <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600" type="password" name="password" placeholder="••••••••" required />
            </label>

            <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Acessar</button>
          </form>
        </div>
      </section>
    </main>
  );
}
