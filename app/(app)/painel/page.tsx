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

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function weightedAverage(rows: UnitMetric[], valueKey: keyof UnitMetric) {
  const validRows = rows.filter((row) => safeNumber(row.total_evaluations) > 0);
  const total = validRows.reduce((sum, row) => sum + safeNumber(row.total_evaluations), 0);

  if (!total) return 0;

  return (
    validRows.reduce((sum, row) => sum + safeNumber(row[valueKey]) * safeNumber(row.total_evaluations), 0) / total
  );
}

export default async function PainelPage() {
  const dashboard = await getDashboardData();
  const unitsWithEvaluations = dashboard.units.filter((unit) => safeNumber(unit.total_evaluations) > 0);
  const totalEvaluations = unitsWithEvaluations.reduce((sum, row) => sum + safeNumber(row.total_evaluations), 0);
  const generalScore = weightedAverage(unitsWithEvaluations, 'avg_general_score');
  const satisfactionScore = weightedAverage(unitsWithEvaluations, 'avg_satisfaction_score');
  const resolutionRate = weightedAverage(unitsWithEvaluations, 'resolution_rate');
  const waitTime = weightedAverage(unitsWithEvaluations, 'avg_wait_time_minutes');
  const chartUnits = [...unitsWithEvaluations]
    .sort((left, right) => safeNumber(right.avg_general_score) - safeNumber(left.avg_general_score))
    .slice(0, 10);

  return (
    <>
      <PageHeader title="Painel" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Nota geral" value={formatNumber(generalScore)} hint="Media municipal" />
        <StatCard label="Satisfacao" value={formatNumber(satisfactionScore)} hint="Media dos usuarios" />
        <StatCard label="Resolucao" value={`${formatNumber(resolutionRate)}%`} hint="Atendimentos resolvidos" />
        <StatCard label="Espera media" value={`${formatNumber(waitTime, 0)} min`} hint="Media informada" />
        <StatCard label="Avaliacoes" value={formatInteger(totalEvaluations)} hint="Total registrado" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Evolucao mensal da nota geral">
          {dashboard.errors.monthly ? (
            <EmptyState title="Nao foi possivel carregar os dados." description={getFriendlySupabaseError(dashboard.errors.monthly, 'Nao foi possivel carregar os dados.')} />
          ) : dashboard.monthly.length ? (
            <LazyMonthlyChart data={dashboard.monthly} />
          ) : (
            <EmptyState title="Sem dados." />
          )}
        </SectionCard>

        <SectionCard title="Notas por unidade">
          {dashboard.errors.units ? (
            <EmptyState title="Nao foi possivel carregar os dados." description={getFriendlySupabaseError(dashboard.errors.units, 'Nao foi possivel carregar os dados.')} />
          ) : chartUnits.length ? (
            <LazyUnitBarChart data={chartUnits} />
          ) : (
            <EmptyState title="Sem dados." />
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Resumo por unidade">
          {dashboard.errors.units ? (
            <EmptyState title="Nao foi possivel carregar os dados." description={getFriendlySupabaseError(dashboard.errors.units, 'Nao foi possivel carregar os dados.')} />
          ) : (
            <div className="table-responsive overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-3">Unidade</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Avaliacoes</th>
                    <th className="px-3 py-3">Nota</th>
                    <th className="px-3 py-3">Resolucao</th>
                    <th className="px-3 py-3">Espera</th>
                  </tr>
                </thead>
                <tbody>
                  {unitsWithEvaluations.slice(0, 8).map((unit) => (
                    <tr key={unit.health_unit_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 font-semibold text-slate-900">{unit.health_unit_name}</td>
                      <td className="px-3 py-3">{labelUnitType(unit.health_unit_type)}</td>
                      <td className="px-3 py-3">{formatInteger(unit.total_evaluations)}</td>
                      <td className="px-3 py-3">{formatNumber(unit.avg_general_score)}</td>
                      <td className="px-3 py-3">{formatNumber(unit.resolution_rate)}%</td>
                      <td className="px-3 py-3">{formatNumber(unit.avg_wait_time_minutes, 0)} min</td>
                    </tr>
                  ))}
                  {!unitsWithEvaluations.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8">
                        <EmptyState title="Nenhum registro encontrado." />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Profissionais em destaque">
          {dashboard.errors.professionals ? (
            <EmptyState title="Nao foi possivel carregar os dados." description={getFriendlySupabaseError(dashboard.errors.professionals, 'Nao foi possivel carregar os dados.')} />
          ) : dashboard.highlightedProfessionals.length ? (
            <div className="space-y-3">
              {dashboard.highlightedProfessionals.map((professional, index) => (
                <div key={professional.professional_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{index + 1}. {professional.professional_name}</div>
                    <div className="text-xs text-slate-500">{professional.position} - {professional.health_unit_name}</div>
                  </div>
                  <div className="text-lg font-semibold text-blue-700">{formatNumber(professional.avg_professional_score)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum profissional avaliado." />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Observacoes recentes">
          {dashboard.errors.notes ? (
            <EmptyState title="Nao foi possivel carregar os dados." description={getFriendlySupabaseError(dashboard.errors.notes, 'Nao foi possivel carregar os dados.')} />
          ) : dashboard.notes.length ? (
            <div className={dashboard.notes.length === 1 ? 'max-w-3xl' : 'grid gap-4 md:grid-cols-2'}>
              {dashboard.notes.map((note) => (
                <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{labelManifestation(note.manifestation)}</span>
                    <span>{formatDate(note.attendance_date)}</span>
                    <span>Nota {formatNumber(note.general_score, 0)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.general_notes}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{note.health_unit_name}</span>
                    <span> - {note.patient_name}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma observacao registrada." description="As avaliacoes com comentario aparecem aqui automaticamente." />
          )}
        </SectionCard>
      </div>
    </>
  );
}
