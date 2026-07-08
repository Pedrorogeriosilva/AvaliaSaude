import Link from 'next/link';

type Props = { page: number; hasNextPage: boolean; basePath: string; query?: string };

function buildHref(basePath: string, page: number, query?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (query) params.set('q', query);
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function PaginationControls({ page, hasNextPage, basePath, query }: Props) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
      <Link
        href={buildHref(basePath, Math.max(1, page - 1), query)}
        prefetch={false}
        aria-disabled={page <= 1}
        className={`rounded-lg border px-4 py-2 text-sm font-semibold ${page <= 1 ? 'pointer-events-none border-slate-200 text-slate-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
      >
        Anterior
      </Link>
      <span className="text-sm text-slate-500">Página {page}</span>
      <Link
        href={buildHref(basePath, page + 1, query)}
        prefetch={false}
        aria-disabled={!hasNextPage}
        className={`rounded-lg border px-4 py-2 text-sm font-semibold ${!hasNextPage ? 'pointer-events-none border-slate-200 text-slate-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
      >
        Próxima
      </Link>
    </div>
  );
}
