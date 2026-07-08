type Props = { title: string; description?: string };

export function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}
