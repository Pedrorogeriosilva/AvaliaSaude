'use client';

import dynamic from 'next/dynamic';
import type { UnitMetric } from '@/types';
import { ChartPlaceholder } from '@/components/dashboard/chart-placeholder';

const UnitBarChart = dynamic(
  () => import('@/components/dashboard/unit-bar-chart').then((mod) => mod.UnitBarChart),
  {
    ssr: false,
    loading: () => <ChartPlaceholder emptyMessage="Carregando gráfico por unidade..." />,
  },
);

type Props = {
  data: UnitMetric[];
};

export function LazyUnitBarChart({ data }: Props) {
  return <UnitBarChart data={data} />;
}
