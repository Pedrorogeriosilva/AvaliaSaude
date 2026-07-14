type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, children }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950 md:text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}
