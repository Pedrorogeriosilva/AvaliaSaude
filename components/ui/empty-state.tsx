type Props = { title: string; description: string };

export function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}