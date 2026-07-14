'use client';

import dynamic from 'next/dynamic';
import type { CityMonthlyMetric } from '@/types';
import { ChartPlaceholder } from '@/components/dashboard/chart-placeholder';

const MonthlyChart = dynamic(
  () => import('@/components/dashboard/monthly-chart').then((mod) => mod.MonthlyChart),
  {
    ssr: false,
    loading: () => <ChartPlaceholder emptyMessage="Carregando..." />,
  },
);

type Props = {
  data: CityMonthlyMetric[];
};

export function LazyMonthlyChart({ data }: Props) {
  return <MonthlyChart data={data} />;
}
