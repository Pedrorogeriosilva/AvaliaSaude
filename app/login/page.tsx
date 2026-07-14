import { LockKeyhole } from 'lucide-react';
import { SiteLogo } from '@/components/ui/site-logo';
import { getFriendlyErrorMessage } from '@/lib/supabase/errors';
import { loginAction } from './actions';

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 md:p-10">
        <div className="mb-8 flex justify-center">
          <SiteLogo size="lg" priority />
        </div>

        <div className="mb-7">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <LockKeyhole size={24} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Entrar no sistema</h2>
        </div>

        {params.error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getFriendlyErrorMessage(params.error)}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">E-mail</span>
            <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600" type="email" name="email" required />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Senha</span>
            <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600" type="password" name="password" required />
          </label>

          <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Acessar</button>
        </form>
      </section>
    </main>
  );
}
