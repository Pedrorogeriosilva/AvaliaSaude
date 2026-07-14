'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = {
  month: string;
  avg_general_score: number | string | null;
};

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMonthLabel(value: string) {
  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export function MonthlyChart({ data }: { data: Row[] }) {
  const chartData = data.map((item) => ({
    mes: formatMonthLabel(item.month),
    nota: safeNumber(item.avg_general_score),
  }));

  if (!chartData.length) {
    return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Sem dados mensais ainda.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
          <YAxis domain={[0, 10]} stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1', boxShadow: '0 10px 30px rgba(15,23,42,0.08)' }}
            formatter={(value: number | string) => [`${safeNumber(value).toFixed(1)}`, 'Nota média']}
          />
          <Line type="monotone" dataKey="nota" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6, fill: '#2563eb' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
