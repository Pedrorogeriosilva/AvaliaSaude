import 'server-only';

import { cache } from 'react';
import { maskCpf, obfuscatePatientName } from '@/lib/format';
import { measureAsync } from '@/lib/performance';
import { createClient } from '@/lib/supabase/server';
import { buildSearchPattern, normalizeSearchQuery } from '@/lib/validation';
import type {
  CityMonthlyMetric,
  EvaluationNote,
  HealthUnit,
  Patient,
  Professional,
  ProfessionalMetric,
  UnitMetric,
} from '@/types';

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

type QueryError = {
  message: string;
  code?: string;
  status?: number;
  details?: string | null;
  hint?: string | null;
} | null;

type DashboardSectionErrors = {
  units: QueryError;
  monthly: QueryError;
  professionals: QueryError;
  notes: QueryError;
};

type QueryResult<T> = {
  data: T[] | null;
  error: QueryError;
};

export type DashboardSectionResult<T> = {
  data: T;
  error: QueryError;
};

export type EvaluationFormData = {
  patients: Pick<Patient, 'id' | 'full_name' | 'cpf'>[];
  units: Pick<HealthUnit, 'id' | 'name'>[];
  professionals: Pick<Professional, 'id' | 'full_name' | 'position' | 'health_unit_id' | 'work_schedule'>[];
  error: QueryError;
};

export type RankingData = {
  bestUnits: UnitMetric[];
  worstUnits: UnitMetric[];
  bestProfessionals: ProfessionalMetric[];
  worstProfessionals: ProfessionalMetric[];
  error: QueryError;
};

const RECENT_NOTES_LIMIT = 8;
const RECENT_NOTES_FETCH_LIMIT = 24;

type EvaluationNoteQueryRow = {
  id: string;
  attendance_date: string;
  manifestation: EvaluationNote['manifestation'];
  general_score: number | string | null;
  general_notes: string | null;
  created_at: string;
  patients?: { id: string; full_name: string; status?: string | null } | { id: string; full_name: string; status?: string | null }[] | null;
  health_units?: { id: string; name: string; status?: string | null } | { id: string; name: string; status?: string | null }[] | null;
};

type ProfessionalFormRow = Pick<Professional, 'id' | 'full_name' | 'position' | 'health_unit_id' | 'work_schedule'> & {
  health_units?: { status?: string | null } | { status?: string | null }[] | null;
};

function normalizeError(error: unknown): QueryError {
  if (!error) return null;

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as Record<string, unknown>;
    const message = typeof maybeError.message === 'string' ? maybeError.message : 'Erro desconhecido.';

    return {
      message,
      code: typeof maybeError.code === 'string' ? maybeError.code : undefined,
      status: typeof maybeError.status === 'number' ? maybeError.status : undefined,
      details: typeof maybeError.details === 'string' ? maybeError.details : null,
      hint: typeof maybeError.hint === 'string' ? maybeError.hint : null,
    };
  }

  return { message: String(error) };
}

function firstError(results: QueryResult<unknown>[]) {
  return results.find((result) => result.error)?.error || null;
}

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function logDashboardError(section: keyof DashboardSectionErrors, error: QueryError) {
  if (!error || process.env.NODE_ENV !== 'development') return;

  console.error(`[dashboard:${section}]`, {
    message: error.message,
    code: error.code,
    status: error.status,
  });
}

const getReadClient = cache(async () => createClient());

async function withReadClient<T>(label: string, task: (supabase: SupabaseClientLike) => Promise<T>) {
  return measureAsync(label, async () => {
    const supabase = await getReadClient();
    return task(supabase);
  });
}

const fetchUnitMetrics = cache(async (cityId?: string): Promise<DashboardSectionResult<UnitMetric[]>> =>
  withReadClient('getDashboardSummaryData', async (supabase) => {
    try {
      let query = supabase
        .from('v_unit_metrics')
        .select('health_unit_id, health_unit_name, health_unit_type, health_unit_status, city_id, total_evaluations, avg_general_score, avg_structure_score, avg_wait_time_score, resolution_rate, last_evaluation_date')
        .eq('health_unit_status', 'active')
        .order('avg_general_score', { ascending: false, nullsFirst: false })
        .limit(200);

      if (cityId) query = query.eq('city_id', cityId);

      const { data, error } = await query;

      return {
        data: (data || []) as UnitMetric[],
        error: normalizeError(error),
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

type MonthlyRow = { city_id: string | null; month: string; avg_general_score: number | string | null; total_evaluations: number | string | null };

const fetchMonthlyMetrics = cache(async (cityId?: string): Promise<DashboardSectionResult<CityMonthlyMetric[]>> =>
  withReadClient('getDashboardChartData.monthly', async (supabase) => {
    try {
      let query = supabase
        .from('v_city_monthly_metrics')
        .select('city_id, month, avg_general_score, total_evaluations');

      if (cityId) query = query.eq('city_id', cityId);

      const { data, error } = await query;
      if (error) {
        return { data: [], error: normalizeError(error) };
      }

      // A view vem por (cidade, mês). Reagrupamos por mês ponderando a nota pela
      // quantidade de avaliações — média de médias entre cidades seria incorreta.
      const byMonth = new Map<string, { sum: number; total: number }>();
      for (const row of (data || []) as MonthlyRow[]) {
        const total = safeNumber(row.total_evaluations);
        if (total <= 0) continue;
        const current = byMonth.get(row.month) || { sum: 0, total: 0 };
        current.sum += safeNumber(row.avg_general_score) * total;
        current.total += total;
        byMonth.set(row.month, current);
      }

      const months = Array.from(byMonth.entries())
        .map(([month, aggregate]) => ({
          month,
          avg_general_score: aggregate.total ? Number((aggregate.sum / aggregate.total).toFixed(2)) : 0,
        }))
        .sort((left, right) => (left.month < right.month ? -1 : left.month > right.month ? 1 : 0));

      return {
        data: months.slice(-12) as CityMonthlyMetric[],
        error: null,
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

/**
 * A view `v_professional_metrics` já agrega as notas e descarta avaliações de
 * paciente, unidade ou autor inativo. Antes isso era refeito aqui em JS, o que
 * exigia baixar todas as linhas de `evaluation_professionals` do município e
 * mais três consultas de apoio a cada carregamento do painel.
 */
const fetchProfessionalMetrics = cache(async (cityId?: string): Promise<DashboardSectionResult<ProfessionalMetric[]>> =>
  withReadClient('getDashboardProfessionalsData', async (supabase) => {
    try {
      let query = supabase
        .from('v_professional_metrics')
        .select('professional_id, professional_name, position, health_unit_id, health_unit_name, city_id, professional_status, health_unit_status, total_evaluations, avg_professional_score, last_evaluation_date')
        .eq('professional_status', 'active')
        .eq('health_unit_status', 'active')
        .gt('total_evaluations', 0)
        .order('avg_professional_score', { ascending: false, nullsFirst: false })
        .limit(200);

      if (cityId) query = query.eq('city_id', cityId);

      const { data, error } = await query;

      if (error) {
        return { data: [], error: normalizeError(error) };
      }

      const professionals = ((data || []) as ProfessionalMetric[]).map((professional) => ({
        ...professional,
        health_unit_name: professional.health_unit_name || 'Unidade nao informada',
        avg_professional_score: safeNumber(professional.avg_professional_score),
        total_evaluations: safeNumber(professional.total_evaluations),
      }));

      professionals.sort((left, right) => {
        const scoreDifference = safeNumber(right.avg_professional_score) - safeNumber(left.avg_professional_score);
        if (scoreDifference !== 0) return scoreDifference;

        const totalDifference = safeNumber(right.total_evaluations) - safeNumber(left.total_evaluations);
        if (totalDifference !== 0) return totalDifference;

        return left.professional_name.localeCompare(right.professional_name, 'pt-BR');
      });

      return {
        data: professionals,
        error: null,
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

const fetchRecentNotes = cache(async (cityId?: string): Promise<DashboardSectionResult<EvaluationNote[]>> =>
  withReadClient('getDashboardNotesData', async (supabase) => {
    try {
      // Uma única consulta com folga sobre o limite. Os joins `!inner` e o
      // filtro de `general_notes` já acontecem no banco; a folga cobre apenas
      // os comentários que são só espaço em branco e caem no filtro abaixo.
      let query = supabase
        .from('evaluations')
        .select(`
          id,
          attendance_date,
          manifestation,
          general_score,
          general_notes,
          created_at,
          patients!inner(id, full_name, status),
          health_units!inner(id, name, status, city_id)
        `)
        .not('general_notes', 'is', null)
        .neq('general_notes', '')
        .eq('patients.status', 'active')
        .eq('health_units.status', 'active')
        .order('created_at', { ascending: false })
        .order('attendance_date', { ascending: false })
        .limit(RECENT_NOTES_FETCH_LIMIT);

      if (cityId) query = query.eq('health_units.city_id', cityId);

      const { data, error } = await query;

      if (error) {
        return { data: [], error: normalizeError(error) };
      }

      const notes: EvaluationNote[] = [];

      for (const row of (data || []) as EvaluationNoteQueryRow[]) {
        if (notes.length >= RECENT_NOTES_LIMIT) break;

        const patient = asSingle(row.patients);
        const healthUnit = asSingle(row.health_units);
        const generalNotes = row.general_notes?.trim() || '';

        if (!generalNotes || !patient?.full_name || !healthUnit?.name) {
          continue;
        }

        notes.push({
          id: row.id,
          attendance_date: row.attendance_date,
          manifestation: row.manifestation,
          general_score: row.general_score,
          general_notes: generalNotes,
          patient_name: obfuscatePatientName(patient.full_name),
          health_unit_name: healthUnit.name,
          created_at: row.created_at,
        });
      }

      return {
        data: notes,
        error: null,
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

export const getDashboardSummaryData = cache(async (cityId?: string): Promise<DashboardSectionResult<UnitMetric[]>> => {
  const result = await fetchUnitMetrics(cityId);
  logDashboardError('units', result.error);
  return result;
});

export const getDashboardChartData = cache(async (cityId?: string): Promise<{ monthly: CityMonthlyMetric[]; units: UnitMetric[]; error: QueryError }> => {
  const [monthlyResult, unitsResult] = await Promise.all([fetchMonthlyMetrics(cityId), fetchUnitMetrics(cityId)]);
  logDashboardError('monthly', monthlyResult.error);
  logDashboardError('units', unitsResult.error);

  return {
    monthly: monthlyResult.data,
    units: unitsResult.data
      .filter((unit) => safeNumber(unit.total_evaluations) > 0)
      .sort((left, right) => safeNumber(right.avg_general_score) - safeNumber(left.avg_general_score))
      .slice(0, 10),
    error: monthlyResult.error || unitsResult.error,
  };
});

export const getDashboardProfessionalsData = cache(async (cityId?: string): Promise<{ professionals: ProfessionalMetric[]; error: QueryError }> => {
  const result = await fetchProfessionalMetrics(cityId);
  logDashboardError('professionals', result.error);
  return { professionals: result.data.slice(0, 5), error: result.error };
});

export const getDashboardNotesData = cache(async (cityId?: string): Promise<{ notes: EvaluationNote[]; error: QueryError }> => {
  const result = await fetchRecentNotes(cityId);
  logDashboardError('notes', result.error);
  return { notes: result.data, error: result.error };
});

export const getEvaluationFormData = cache(async (): Promise<EvaluationFormData> =>
  withReadClient('getEvaluationFormData', async (supabase) => {
    const [patientsResult, unitsResult, professionalsResult] = await Promise.all([
      supabase
        .from('patients')
        .select('id, full_name, cpf')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12),
      supabase.from('health_units').select('id, name').eq('status', 'active').order('name'),
      supabase
        .from('professionals')
        .select('id, full_name, position, health_unit_id, work_schedule, health_units!inner(status)')
        .eq('status', 'active')
        .eq('health_units.status', 'active')
        .order('full_name'),
    ]);

    return {
      patients: ((patientsResult.data || []) as EvaluationFormData['patients']).map((patient) => ({
        ...patient,
        cpf: maskCpf(patient.cpf),
      })),
      units: (unitsResult.data || []) as EvaluationFormData['units'],
      professionals: ((professionalsResult.data || []) as ProfessionalFormRow[]).map(({ health_units, ...professional }) => professional),
      error: firstError([patientsResult, unitsResult, professionalsResult] as QueryResult<unknown>[]),
    };
  }),
);

export type CityComparisonRow = {
  city_id: string;
  city_name: string;
  total_evaluations: number;
  avg_general_score: number;
  resolution_rate: number;
  unit_count: number;
};

/**
 * Consolida as métricas por cidade para a visão "todas as cidades" do master.
 * Parte de `v_unit_metrics` (uma linha por unidade, já com `city_id`) e agrega
 * por cidade ponderando as médias pela quantidade de avaliações.
 */
export const getCityComparison = cache(async (): Promise<{ rows: CityComparisonRow[]; error: QueryError }> => {
  const [unitsResult, cities] = await Promise.all([fetchUnitMetrics(), getActiveCities()]);
  if (unitsResult.error) {
    return { rows: [], error: unitsResult.error };
  }

  const cityNameById = new Map(cities.map((city) => [city.id, `${city.name} / ${city.state_uf}`]));
  const aggregates = new Map<string, { evaluations: number; scoreSum: number; resolutionSum: number; units: number }>();

  for (const unit of unitsResult.data) {
    const cityId = unit.city_id;
    if (!cityId) continue;

    const evaluations = safeNumber(unit.total_evaluations);
    const current = aggregates.get(cityId) || { evaluations: 0, scoreSum: 0, resolutionSum: 0, units: 0 };
    current.units += 1;
    if (evaluations > 0) {
      current.evaluations += evaluations;
      current.scoreSum += safeNumber(unit.avg_general_score) * evaluations;
      current.resolutionSum += safeNumber(unit.resolution_rate) * evaluations;
    }
    aggregates.set(cityId, current);
  }

  const rows: CityComparisonRow[] = Array.from(aggregates.entries()).map(([cityId, aggregate]) => ({
    city_id: cityId,
    city_name: cityNameById.get(cityId) || 'Cidade removida',
    total_evaluations: aggregate.evaluations,
    avg_general_score: aggregate.evaluations ? Number((aggregate.scoreSum / aggregate.evaluations).toFixed(2)) : 0,
    resolution_rate: aggregate.evaluations ? Number((aggregate.resolutionSum / aggregate.evaluations).toFixed(2)) : 0,
    unit_count: aggregate.units,
  }));

  rows.sort((left, right) => right.avg_general_score - left.avg_general_score || right.total_evaluations - left.total_evaluations);

  return { rows, error: null };
});

export const getActiveCities = cache(async (): Promise<{ id: string; name: string; state_uf: string }[]> =>
  withReadClient('getActiveCities', async (supabase) => {
    const { data } = await supabase
      .from('cities')
      .select('id, name, state_uf')
      .eq('status', 'active')
      .order('name');
    return (data || []) as { id: string; name: string; state_uf: string }[];
  }),
);

export async function searchPatients(search: string) {
  const normalized = normalizeSearchQuery(search);
  if (normalized.length < 2) return [];

  const namePattern = buildSearchPattern(normalized);
  if (!namePattern) return [];

  return withReadClient('searchPatients', async (supabase) => {
    const digits = normalized.replace(/\D/g, '');

    const [nameResult, cpfResult] = await Promise.all([
      supabase
        .from('patients')
        .select('id, full_name, cpf')
        .eq('status', 'active')
        .ilike('full_name', namePattern)
        .order('full_name')
        .limit(8),
      digits.length >= 3
        ? supabase
            .from('patients')
            .select('id, full_name, cpf')
            .eq('status', 'active')
            .ilike('cpf', `%${digits}%`)
            .order('full_name')
            .limit(4)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const merged = [...(nameResult.data || []), ...(cpfResult.data || [])];
    const deduped = Array.from(new Map(merged.map((patient) => [patient.id, patient])).values());

    return deduped.slice(0, 10).map((patient) => ({
      ...patient,
      cpf: maskCpf(patient.cpf),
    })) as Pick<Patient, 'id' | 'full_name' | 'cpf'>[];
  });
}

export const getRankingData = cache(async (cityId?: string): Promise<RankingData> => {
  const [unitsResult, professionalsResult] = await Promise.all([fetchUnitMetrics(cityId), fetchProfessionalMetrics(cityId)]);

  logDashboardError('units', unitsResult.error);
  logDashboardError('professionals', professionalsResult.error);

  const activeUnits = unitsResult.data.filter((unit) => safeNumber(unit.total_evaluations) > 0);
  const activeProfessionals = professionalsResult.data.filter((professional) => safeNumber(professional.total_evaluations) > 0);

  return {
    bestUnits: [...activeUnits]
      .sort((left, right) => safeNumber(right.avg_general_score) - safeNumber(left.avg_general_score))
      .slice(0, 8),
    worstUnits: [...activeUnits]
      .sort((left, right) => safeNumber(left.avg_general_score) - safeNumber(right.avg_general_score))
      .slice(0, 8),
    bestProfessionals: [...activeProfessionals]
      .sort((left, right) => safeNumber(right.avg_professional_score) - safeNumber(left.avg_professional_score))
      .slice(0, 8),
    worstProfessionals: [...activeProfessionals]
      .sort((left, right) => safeNumber(left.avg_professional_score) - safeNumber(right.avg_professional_score))
      .slice(0, 8),
    error: unitsResult.error || professionalsResult.error,
  };
});
