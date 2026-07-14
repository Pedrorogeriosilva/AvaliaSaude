import type { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export function DisclosureCard({ title, meta, children, defaultOpen = false, className }: Props) {
  return (
    <details open={defaultOpen} className={clsx('group rounded-xl border border-slate-200 bg-white', className)}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {meta ? <div className="text-xs text-slate-500">{meta}</div> : null}
          <span className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition group-open:bg-slate-50">
            Editar
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}
