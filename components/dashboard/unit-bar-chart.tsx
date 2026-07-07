'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

type Row = {
  health_unit_name: string;
  avg_general_score: number | string | null;
};

export function UnitBarChart({ data }: { data: Row[] }) {
  const chartData = data
    .filter((item) => item.avg_general_score !== null)
    .slice(0, 10)
    .map((item) => ({
      unidade: item.health_unit_name,
      nota: Number(item.avg_general_score || 0),
    }));

  if (!chartData.length) {
    return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Sem notas por unidade ainda.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="unidade" hide />
          <YAxis domain={[0, 10]} />
          <Tooltip />
          <Bar dataKey="nota" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
