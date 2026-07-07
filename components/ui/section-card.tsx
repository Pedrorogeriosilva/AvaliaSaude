type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, description, children }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 gov-shadow">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
