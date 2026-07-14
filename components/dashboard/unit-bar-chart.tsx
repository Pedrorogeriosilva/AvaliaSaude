'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = {
  health_unit_name: string;
  avg_general_score: number | string | null;
};

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortenLabel(value: string) {
  return value.length > 26 ? `${value.slice(0, 26)}…` : value;
}

export function UnitBarChart({ data }: { data: Row[] }) {
  const chartData = data
    .filter((item) => item.avg_general_score !== null)
    .slice(0, 10)
    .map((item) => ({
      unidade: shortenLabel(item.health_unit_name),
      unidadeCompleta: item.health_unit_name,
      nota: safeNumber(item.avg_general_score),
    }));

  if (!chartData.length) {
    return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Sem notas por unidade ainda.</div>;
  }

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 36, left: 18, bottom: 8 }} barCategoryGap={12}>
          <CartesianGrid horizontal stroke="#e2e8f0" vertical={false} />
          <XAxis type="number" domain={[0, 10]} tickCount={6} stroke="#64748b" fontSize={12} />
          <YAxis type="category" dataKey="unidade" width={155} stroke="#334155" fontSize={12} />
          <Tooltip
            cursor={{ fill: '#eff6ff' }}
            contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1', boxShadow: '0 10px 30px rgba(15,23,42,0.08)' }}
            formatter={(value: number | string) => [`${safeNumber(value).toFixed(1)}`, 'Nota média']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.unidadeCompleta || 'Unidade'}
          />
          <Bar dataKey="nota" fill="#2563eb" radius={[0, 8, 8, 0]} maxBarSize={28}>
            <LabelList dataKey="nota" position="right" fill="#0f172a" fontSize={12} formatter={(value: number | string) => safeNumber(value).toFixed(1)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
