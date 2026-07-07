import { MonthlyChart } from '@/components/dashboard/monthly-chart';
import { UnitBarChart } from '@/components/dashboard/unit-bar-chart';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { formatInteger, formatNumber, labelUnitType } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { CityMonthlyMetric, ProfessionalMetric, UnitMetric } from '@/types';

function weightedAverage(rows: UnitMetric[], valueKey: keyof UnitMetric) {
  const total = rows.reduce((sum, row) => sum + Number(row.total_evaluations || 0), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[valueKey] || 0) * Number(row.total_evaluations || 0), 0) / total;
}

export default async function PainelPage() {
  const supabase = await createClient();

  const [{ data: unitMetrics }, { data: cityMonthly }, { data: professionalMetrics }] = await Promise.all([
    supabase.from('v_unit_metrics').select('*').order('avg_general_score', { ascending: false, nullsFirst: false }),
    supabase.from('v_city_monthly_metrics').select('*').order('month', { ascending: true }),
    supabase.from('v_professional_metrics').select('*').order('avg_professional_score', { ascending: false, nullsFirst: false }).limit(5),
  ]);

  const units = (unitMetrics || []) as UnitMetric[];
  const monthly = (cityMonthly || []) as CityMonthlyMetric[];
  const highlightedProfessionals = (professionalMetrics || []) as ProfessionalMetric[];
  const totalEvaluations = units.reduce((sum, row) => sum + Number(row.total_evaluations || 0), 0);
  const generalScore = weightedAverage(units, 'avg_general_score');
  const satisfactionScore = weightedAverage(units, 'avg_satisfaction_score');
  const resolutionRate = weightedAverage(units, 'resolution_rate');
  const waitTime = weightedAverage(units, 'avg_wait_time_minutes');

  return (
    <>
      <PageHeader
        title="Painel"
        description="Visão geral dos indicadores municipais e das unidades de saúde cadastradas."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Nota geral" value={formatNumber(generalScore)} hint="Média municipal" />
        <StatCard label="Satisfação" value={formatNumber(satisfactionScore)} hint="Média dos usuários" />
        <StatCard label="Resolução" value={`${formatNumber(resolutionRate)}%`} hint="Atendimentos resolvidos" />
        <StatCard label="Espera média" value={`${formatNumber(waitTime, 0)} min`} hint="Média informada" />
        <StatCard label="Avaliações" value={formatInteger(totalEvaluations)} hint="Total registrado" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Evolução mensal da nota geral" description="Média geral da cidade por mês.">
          <MonthlyChart data={monthly} />
        </SectionCard>

        <SectionCard title="Notas por unidade" description="Até 10 unidades com maior média geral.">
          <UnitBarChart data={units} />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Resumo por unidade" description="Indicadores consolidados das unidades de saúde.">
          <div className="table-responsive">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Avaliações</th>
                  <th className="px-3 py-3">Nota</th>
                  <th className="px-3 py-3">Resolução</th>
                  <th className="px-3 py-3">Espera</th>
                </tr>
              </thead>
              <tbody>
                {units.slice(0, 8).map((unit) => (
                  <tr key={unit.health_unit_id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{unit.health_unit_name}</td>
                    <td className="px-3 py-3">{labelUnitType(unit.health_unit_type)}</td>
                    <td className="px-3 py-3">{formatInteger(unit.total_evaluations)}</td>
                    <td className="px-3 py-3">{formatNumber(unit.avg_general_score)}</td>
                    <td className="px-3 py-3">{formatNumber(unit.resolution_rate)}%</td>
                    <td className="px-3 py-3">{formatNumber(unit.avg_wait_time_minutes, 0)} min</td>
                  </tr>
                ))}
                {!units.length ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nenhuma unidade cadastrada.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Profissionais em destaque" description="Maiores médias individuais registradas.">
          <div className="space-y-3">
            {highlightedProfessionals.map((professional, index) => (
              <div key={professional.professional_id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{index + 1}. {professional.professional_name}</div>
                  <div className="text-xs text-slate-500">{professional.position} · {professional.health_unit_name}</div>
                </div>
                <div className="text-lg font-bold text-blue-700">{formatNumber(professional.avg_professional_score)}</div>
              </div>
            ))}
            {!highlightedProfessionals.length ? (
              <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhum profissional avaliado ainda.</div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </>
  );
}