import { Suspense } from 'react';
import { CityFilter } from '@/components/dashboard/city-filter';
import { LazyMonthlyChart } from '@/components/dashboard/lazy-monthly-chart';
import { LazyUnitBarChart } from '@/components/dashboard/lazy-unit-bar-chart';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  getActiveCities,
  getCityComparison,
  getDashboardChartData,
  getDashboardNotesData,
  getDashboardProfessionalsData,
  getDashboardSummaryData,
} from '@/lib/app-data';
import { getCurrentProfile } from '@/lib/auth';
import { formatDate, formatInteger, formatNumber, labelManifestation, labelUnitType } from '@/lib/format';
import { getFriendlySupabaseError } from '@/lib/supabase/errors';
import type { UnitMetric } from '@/types';

type Props = { searchParams?: Promise<{ cidade?: string }> };

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

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

function StatsFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Block key={index} className="min-h-28 border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

function CardFallback({ className = 'h-80' }: { className?: string }) {
  return <Block className={`${className} border border-slate-200 bg-white`} />;
}

function LoadError({ error }: { error: Parameters<typeof getFriendlySupabaseError>[0] }) {
  return (
    <EmptyState
      title="Nao foi possivel carregar os dados."
      description={getFriendlySupabaseError(error, 'Nao foi possivel carregar os dados.')}
    />
  );
}

/**
 * Cada seção busca só o que precisa e é envolvida em <Suspense>, então o
 * cabeçalho e o título aparecem de imediato e cada bloco entra assim que a
 * consulta dele termina. Antes a página inteira esperava a consulta mais lenta
 * das quatro antes de mostrar qualquer coisa.
 *
 * As funções de leitura usam `cache()` do React, então `v_unit_metrics` é
 * consultada uma única vez por requisição mesmo com três seções pedindo por ela.
 */

async function StatsSection({ cityId }: { cityId?: string }) {
  const { data: units, error } = await getDashboardSummaryData(cityId);

  if (error) return <LoadError error={error} />;

  const unitsWithEvaluations = units.filter((unit) => safeNumber(unit.total_evaluations) > 0);
  const totalEvaluations = unitsWithEvaluations.reduce((sum, row) => sum + safeNumber(row.total_evaluations), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Nota geral" value={formatNumber(weightedAverage(unitsWithEvaluations, 'avg_general_score'))} hint="Media municipal" />
      <StatCard label="Satisfacao" value={formatNumber(weightedAverage(unitsWithEvaluations, 'avg_satisfaction_score'))} hint="Media dos usuarios" />
      <StatCard label="Resolucao" value={`${formatNumber(weightedAverage(unitsWithEvaluations, 'resolution_rate'))}%`} hint="Atendimentos resolvidos" />
      <StatCard label="Espera media" value={`${formatNumber(weightedAverage(unitsWithEvaluations, 'avg_wait_time_minutes'), 0)} min`} hint="Media informada" />
      <StatCard label="Avaliacoes" value={formatInteger(totalEvaluations)} hint="Total registrado" />
    </div>
  );
}

async function MonthlyChartSection({ cityId }: { cityId?: string }) {
  const { monthly, error } = await getDashboardChartData(cityId);

  if (error) return <LoadError error={error} />;
  if (!monthly.length) return <EmptyState title="Sem dados." />;

  return <LazyMonthlyChart data={monthly} />;
}

async function UnitChartSection({ cityId }: { cityId?: string }) {
  const { units, error } = await getDashboardChartData(cityId);

  if (error) return <LoadError error={error} />;
  if (!units.length) return <EmptyState title="Sem dados." />;

  return <LazyUnitBarChart data={units} />;
}

async function UnitTableSection({ cityId }: { cityId?: string }) {
  const { data: units, error } = await getDashboardSummaryData(cityId);

  if (error) return <LoadError error={error} />;

  const unitsWithEvaluations = units.filter((unit) => safeNumber(unit.total_evaluations) > 0);
  const visibleUnits = unitsWithEvaluations.slice(0, 8);

  if (!visibleUnits.length) {
    return <EmptyState title="Nenhum registro encontrado." />;
  }

  return (
    <>
      {/*
        No celular a tabela de 6 colunas exigia arrastar na horizontal dentro do
        card — e quem não percebe a barra simplesmente não vê metade dos dados.
        Cada unidade vira um card empilhado; a tabela volta a partir de md.
      */}
      <ul className="space-y-3 md:hidden">
        {visibleUnits.map((unit) => (
          <li key={unit.health_unit_id} className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">{unit.health_unit_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">{labelUnitType(unit.health_unit_type)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <UnitMetricItem label="Nota" value={formatNumber(unit.avg_general_score)} />
              <UnitMetricItem label="Avaliacoes" value={formatInteger(unit.total_evaluations)} />
              <UnitMetricItem label="Resolucao" value={`${formatNumber(unit.resolution_rate)}%`} />
              <UnitMetricItem label="Espera" value={`${formatNumber(unit.avg_wait_time_minutes, 0)} min`} />
            </dl>
          </li>
        ))}
      </ul>

      <div className="table-responsive hidden md:block">
        <table className="w-full min-w-[640px] text-sm">
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
            {visibleUnits.map((unit) => (
              <tr key={unit.health_unit_id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 font-semibold text-slate-900">{unit.health_unit_name}</td>
                <td className="px-3 py-3">{labelUnitType(unit.health_unit_type)}</td>
                <td className="px-3 py-3">{formatInteger(unit.total_evaluations)}</td>
                <td className="px-3 py-3">{formatNumber(unit.avg_general_score)}</td>
                <td className="px-3 py-3">{formatNumber(unit.resolution_rate)}%</td>
                <td className="px-3 py-3">{formatNumber(unit.avg_wait_time_minutes, 0)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UnitMetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

async function ProfessionalsSection({ cityId }: { cityId?: string }) {
  const { professionals, error } = await getDashboardProfessionalsData(cityId);

  if (error) return <LoadError error={error} />;
  if (!professionals.length) return <EmptyState title="Nenhum profissional avaliado." />;

  return (
    <div className="space-y-3">
      {professionals.map((professional, index) => (
        <div key={professional.professional_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{index + 1}. {professional.professional_name}</div>
            <div className="text-xs text-slate-500">{professional.position} - {professional.health_unit_name}</div>
          </div>
          <div className="text-lg font-semibold text-blue-700">{formatNumber(professional.avg_professional_score)}</div>
        </div>
      ))}
    </div>
  );
}

async function NotesSection({ cityId }: { cityId?: string }) {
  const { notes, error } = await getDashboardNotesData(cityId);

  if (error) return <LoadError error={error} />;

  if (!notes.length) {
    return (
      <EmptyState
        title="Nenhuma observacao registrada."
        description="As avaliacoes com comentario aparecem aqui automaticamente."
      />
    );
  }

  return (
    <div className={notes.length === 1 ? 'max-w-3xl' : 'grid gap-4 md:grid-cols-2'}>
      {notes.map((note) => (
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
  );
}

async function CityComparisonSection() {
  const { rows, error } = await getCityComparison();

  if (error) return <LoadError error={error} />;
  if (rows.length < 2) return null;

  return (
    <div className="mb-6">
      <SectionCard title="Comparativo por cidade">
        <div className="table-responsive">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-3">Cidade</th>
                <th className="px-3 py-3">Unidades</th>
                <th className="px-3 py-3">Avaliacoes</th>
                <th className="px-3 py-3">Nota</th>
                <th className="px-3 py-3">Resolucao</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.city_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.city_name}</td>
                  <td className="px-3 py-3">{formatInteger(row.unit_count)}</td>
                  <td className="px-3 py-3">{formatInteger(row.total_evaluations)}</td>
                  <td className="px-3 py-3 font-semibold text-blue-700">{formatNumber(row.avg_general_score)}</td>
                  <td className="px-3 py-3">{formatNumber(row.resolution_rate)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default async function PainelPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const profile = await getCurrentProfile();
  const isMaster = Boolean(profile?.is_master);

  // Só o master escolhe cidade. Para os demais, o RLS já limita, então cityId
  // fica indefinido (a consulta não precisa filtrar de novo).
  const cities = isMaster ? await getActiveCities() : [];
  const requestedCity = params.cidade || '';
  const selectedCityId = isMaster && cities.some((city) => city.id === requestedCity) ? requestedCity : '';
  const cityId = selectedCityId || undefined;
  const showComparison = isMaster && !cityId;

  return (
    <>
      <PageHeader
        title="Painel"
        actions={isMaster && cities.length ? <CityFilter cities={cities} selectedCityId={selectedCityId} /> : undefined}
      />

      {showComparison ? (
        <Suspense fallback={<CardFallback className="h-40" />}>
          <CityComparisonSection />
        </Suspense>
      ) : null}

      <Suspense key={`stats-${cityId ?? 'all'}`} fallback={<StatsFallback />}>
        <StatsSection cityId={cityId} />
      </Suspense>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Evolucao mensal da nota geral">
          <Suspense key={`monthly-${cityId ?? 'all'}`} fallback={<CardFallback className="h-72" />}>
            <MonthlyChartSection cityId={cityId} />
          </Suspense>
        </SectionCard>

        <SectionCard title="Notas por unidade">
          <Suspense key={`unitchart-${cityId ?? 'all'}`} fallback={<CardFallback className="h-72" />}>
            <UnitChartSection cityId={cityId} />
          </Suspense>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Resumo por unidade">
          <Suspense key={`unittable-${cityId ?? 'all'}`} fallback={<CardFallback className="h-64" />}>
            <UnitTableSection cityId={cityId} />
          </Suspense>
        </SectionCard>

        <SectionCard title="Profissionais em destaque">
          <Suspense key={`pros-${cityId ?? 'all'}`} fallback={<CardFallback className="h-64" />}>
            <ProfessionalsSection cityId={cityId} />
          </Suspense>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Observacoes recentes">
          <Suspense key={`notes-${cityId ?? 'all'}`} fallback={<CardFallback className="h-52" />}>
            <NotesSection cityId={cityId} />
          </Suspense>
        </SectionCard>
      </div>
    </>
  );
}
