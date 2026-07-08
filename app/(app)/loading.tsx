function SkeletonCard() {
  return <div className="min-h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}