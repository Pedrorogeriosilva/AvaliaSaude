'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

type Row = {
  month: string;
  avg_general_score: number | string | null;
};

export function MonthlyChart({ data }: { data: Row[] }) {
  const chartData = data.map((item) => ({
    mes: new Date(`${item.month}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    nota: Number(item.avg_general_score || 0),
  }));

  if (!chartData.length) {
    return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Sem dados mensais ainda.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mes" />
          <YAxis domain={[0, 10]} />
          <Tooltip />
          <Line type="monotone" dataKey="nota" strokeWidth={3} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
