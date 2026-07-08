import clsx from 'clsx';

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const active = status === 'active';
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}
