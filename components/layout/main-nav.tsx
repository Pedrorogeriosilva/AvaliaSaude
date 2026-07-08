'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';

export type NavItem = {
  href: string;
  label: string;
};

type Props = {
  items: NavItem[];
  variant?: 'desktop' | 'mobile';
};

export function MainNav({ items, variant = 'desktop' }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function warmRoute(href: string) {
    router.prefetch(href);
  }

  if (variant === 'mobile') {
    return (
      <nav className="grid grid-cols-4 gap-1" aria-label="Menu principal mobile">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => warmRoute(item.href)}
              onFocus={() => warmRoute(item.href)}
              className={clsx(
                'rounded-lg px-2 py-2 text-center text-xs font-semibold transition',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex" aria-label="Menu principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            onMouseEnter={() => warmRoute(item.href)}
            onFocus={() => warmRoute(item.href)}
            className={clsx(
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:text-blue-700',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
