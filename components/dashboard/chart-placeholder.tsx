type Props = {
  emptyMessage: string;
};

export function ChartPlaceholder({ emptyMessage }: Props) {
  return (
    <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">
      {emptyMessage}
    </div>
  );
}
