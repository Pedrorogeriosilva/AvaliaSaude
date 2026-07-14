type PageSkeletonProps = {
  variant?: 'dashboard' | 'form' | 'list' | 'hub';
};

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

export function PageSkeleton({ variant = 'list' }: PageSkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Block className="h-8 w-56" />
          <Block className="h-5 max-w-2xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Block key={index} className="min-h-28 border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Block className="h-80 border border-slate-200 bg-white" />
          <Block className="h-80 border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Block className="h-8 w-44" />
          <Block className="h-5 max-w-2xl" />
        </div>
        <Block className="h-28 border border-slate-200 bg-white" />
        <Block className="h-96 border border-slate-200 bg-white" />
        <Block className="h-56 border border-slate-200 bg-white" />
      </div>
    );
  }

  if (variant === 'hub') {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Block className="h-8 w-40" />
          <Block className="h-5 max-w-xl" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Block key={index} className="h-44 border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Block className="h-8 w-48" />
        <Block className="h-5 max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Block className="h-80 border border-slate-200 bg-white" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Block key={index} className="h-28 border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
