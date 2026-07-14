'use client';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Não foi possível carregar este módulo</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">O sistema encontrou uma falha temporária ao abrir esta página.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Recarregar módulo</button>
    </div>
  );
}
