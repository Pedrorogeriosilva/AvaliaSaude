'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold">Ocorreu um erro inesperado</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Não foi possível carregar esta tela agora. Tente novamente em instantes.</p>
            {error?.digest ? <p className="mt-2 text-xs text-slate-400">Ref.: {error.digest}</p> : null}
            <button onClick={reset} className="mt-6 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Tentar novamente</button>
          </div>
        </main>
      </body>
    </html>
  );
}