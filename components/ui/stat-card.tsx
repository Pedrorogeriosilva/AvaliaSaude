type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 gov-shadow">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </article>
  );
}
