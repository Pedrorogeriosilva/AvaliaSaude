type Props = { title: string; description?: string; actions?: React.ReactNode };

export function PageHeader({ title, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[1.7rem]">{title}</h1>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
