import { LazyMonthlyChart } from '@/components/dashboard/lazy-monthly-chart';
import { LazyUnitBarChart } from '@/components/dashboard/lazy-unit-bar-chart';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { getDashboardData } from '@/lib/app-data';
import { formatDate, formatInteger, formatNumber, labelManifestation, labelUnitType } from '@/lib/format';
import { getFriendlySupabaseError } from '@/lib/supabase/errors';
import type { UnitMetric } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function weightedAverage(rows: UnitMetric[], valueKey: keyof UnitMetric) {
  const total = rows.reduce((sum, row) => sum + Number(row.total_evaluations || 0), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[valueKey] || 0) * Number(row.total_evaluations || 0), 0) / total;
}

export default async function PainelPage() {
  try {
    const { units, monthly, highlightedProfessionals, notes, error, notesError } = await getDashboardData();

    if (error) {
      return <EmptyState title="Painel indisponível" description={getFriendlySupabaseError(error, 'Não foi possível carregar os indicadores no momento.')} />;
    }

    const totalEvaluations = units.reduce((sum, row) => sum + Number(row.total_evaluations || 0), 0);
    const generalScore = weightedAverage(units, 'avg_general_score');
    const satisfactionScore = weightedAverage(units, 'avg_satisfaction_score');
    const resolutionRate = weightedAverage(units, 'resolution_rate');
    const waitTime = weightedAverage(units, 'avg_wait_time_minutes');

    return (
      <>
        <PageHeader title="Painel" description="Visão geral dos indicadores municipais, desempenho das unidades e observações recentes das avaliações." />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Nota geral" value={formatNumber(generalScore)} hint="Média municipal" />
          <StatCard label="Satisfação" value={formatNumber(satisfactionScore)} hint="Média dos usuários" />
          <StatCard label="Resolução" value={`${formatNumber(resolutionRate)}%`} hint="Atendimentos resolvidos" />
          <StatCard label="Espera média" value={`${formatNumber(waitTime, 0)} min`} hint="Média informada" />
          <StatCard label="Avaliações" value={formatInteger(totalEvaluations)} hint="Total registrado" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title="Evolução mensal da nota geral" description="Média geral da cidade por mês. Dados otimizados para carregamento rápido.">
            {monthly.length ? <LazyMonthlyChart data={monthly} /> : <EmptyState title="Sem dados mensais" description="As métricas mensais aparecerão aqui após as primeiras avaliações." />}
          </SectionCard>

          <SectionCard title="Notas por unidade" description="Até 10 unidades com maior média geral.">
            {units.length ? <LazyUnitBarChart data={units} /> : <EmptyState title="Sem unidades avaliadas" description="Cadastre unidades e registre avaliações para visualizar este gráfico." />}
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title="Resumo por unidade" description="Indicadores consolidados das unidades de saúde.">
            <div className="table-responsive">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
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
                    <tr key={unit.health_unit_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 font-semibold text-slate-900">{unit.health_unit_name}</td>
                      <td className="px-3 py-3">{labelUnitType(unit.health_unit_type)}</td>
                      <td className="px-3 py-3">{formatInteger(unit.total_evaluations)}</td>
                      <td className="px-3 py-3">{formatNumber(unit.avg_general_score)}</td>
                      <td className="px-3 py-3">{formatNumber(unit.resolution_rate)}%</td>
                      <td className="px-3 py-3">{formatNumber(unit.avg_wait_time_minutes, 0)} min</td>
                    </tr>
                  ))}
                  {!units.length ? <tr><td colSpan={6} className="px-3 py-8"><EmptyState title="Nenhuma unidade cadastrada" description="As unidades cadastradas aparecerão nesta listagem." /></td></tr> : null}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Profissionais em destaque" description="Maiores médias individuais registradas.">
            <div className="space-y-3">
              {highlightedProfessionals.map((professional, index) => (
                <div key={professional.professional_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{index + 1}. {professional.professional_name}</div>
                    <div className="text-xs text-slate-500">{professional.position} · {professional.health_unit_name}</div>
                  </div>
                  <div className="text-lg font-semibold text-blue-700">{formatNumber(professional.avg_professional_score)}</div>
                </div>
              ))}
              {!highlightedProfessionals.length ? <EmptyState title="Sem profissionais em destaque" description="Os profissionais com avaliações aparecerão aqui." /> : null}
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Observações recentes das avaliações" description="Leitura rápida dos últimos comentários registrados no formulário de avaliação.">
            {notesError ? (
              <EmptyState title="Observações indisponíveis" description={getFriendlySupabaseError(notesError, 'Não foi possível carregar as observações das avaliações.')} />
            ) : notes.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {notes.map((note) => (
                  <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{labelManifestation(note.manifestation)}</span>
                      <span>{formatDate(note.attendance_date)}</span>
                      <span>Nota {formatNumber(note.general_score, 0)}</span>
                    </div>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-700">{note.general_notes}</p>
                    <div className="mt-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{note.health_unit_name}</span>
                      <span> · {note.patient_name}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhuma observação registrada" description="Quando o campo de observações for preenchido nas avaliações, os comentários recentes aparecerão aqui." />
            )}
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Painel indisponível" description="Não foi possível carregar os indicadores. Confira a configuração do Supabase e tente novamente." />;
  }
}
