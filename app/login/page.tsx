import { Activity, LockKeyhole } from 'lucide-react';
import { loginAction } from './actions';

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white gov-shadow md:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-[#123c69] p-10 text-white">
          <div className="mb-10 inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            <Activity size={18} /> Sistema Municipal
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            Avalia Saúde <br /> Porto Alegre do Norte
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-blue-50">
            Plataforma administrativa para acompanhamento de atendimentos, avaliações,
            indicadores de satisfação e desempenho das unidades de saúde do município.
          </p>
          <div className="mt-10 rounded-xl border border-white/20 bg-white/10 p-5 text-sm leading-6 text-blue-50">
            Acesso restrito a administradores, operadores e usuários autorizados pela gestão municipal.
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-7">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <LockKeyhole size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-slate-500">
              Informe seu e-mail e senha cadastrados no Supabase Auth.
            </p>
          </div>

          {params.error ? (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </div>
          ) : null}

          <form action={loginAction} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">E-mail</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
                type="email"
                name="email"
                placeholder="admin@dominio.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Senha</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
                type="password"
                name="password"
                placeholder="••••••••"
                required
              />
            </label>

            <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">
              Acessar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
