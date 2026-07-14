import 'server-only';

import { cache } from 'react';
import { maskCpf, obfuscatePatientName } from '@/lib/format';
import { measureAsync } from '@/lib/performance';
import { createClient } from '@/lib/supabase/server';
import { normalizeSearchQuery } from '@/lib/validation';
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

export type DashboardData = {
  units: UnitMetric[];
  monthly: CityMonthlyMetric[];
  highlightedProfessionals: ProfessionalMetric[];
  notes: EvaluationNote[];
  errors: DashboardSectionErrors;
};

export type RankingData = {
  bestUnits: UnitMetric[];
  worstUnits: UnitMetric[];
  bestProfessionals: ProfessionalMetric[];
  worstProfessionals: ProfessionalMetric[];
  error: QueryError;
};

const RECENT_NOTES_LIMIT = 8;
const RECENT_NOTES_PAGE_SIZE = 24;
const RECENT_NOTES_MAX_PAGES = 5;

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

type ProfessionalQueryRow = {
  id: string;
  full_name: string;
  position: string;
  health_unit_id: string;
  status: string;
  health_units?: { id: string; name: string; status?: string | null } | { id: string; name: string; status?: string | null }[] | null;
};

type EvaluationProfessionalRow = {
  professional_id: string;
  score: number | string | null;
  evaluations?: {
    id: string;
    attendance_date: string;
    patient_id: string;
    health_unit_id: string;
    created_by: string | null;
  } | {
    id: string;
    attendance_date: string;
    patient_id: string;
    health_unit_id: string;
    created_by: string | null;
  }[] | null;
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

const fetchUnitMetrics = cache(async (): Promise<DashboardSectionResult<UnitMetric[]>> =>
  withReadClient('getDashboardSummaryData', async (supabase) => {
    try {
      const { data, error } = await supabase
        .from('v_unit_metrics')
        .select('health_unit_id, health_unit_name, health_unit_type, health_unit_status, total_evaluations, avg_general_score, avg_satisfaction_score, avg_structure_score, avg_clarity_score, avg_service_quality_score, avg_wait_time_minutes, resolution_rate, last_evaluation_date')
        .eq('health_unit_status', 'active')
        .order('avg_general_score', { ascending: false, nullsFirst: false })
        .limit(24);

      return {
        data: (data || []) as UnitMetric[],
        error: normalizeError(error),
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

const fetchMonthlyMetrics = cache(async (): Promise<DashboardSectionResult<CityMonthlyMetric[]>> =>
  withReadClient('getDashboardChartData.monthly', async (supabase) => {
    try {
      const { data, error } = await supabase
        .from('v_city_monthly_metrics')
        .select('month, avg_general_score')
        .order('month', { ascending: false })
        .limit(12);

      return {
        data: [...((data || []) as CityMonthlyMetric[])].reverse(),
        error: normalizeError(error),
      };
    } catch (error) {
      return { data: [], error: normalizeError(error) };
    }
  }),
);

const fetchProfessionalMetrics = cache(async (): Promise<DashboardSectionResult<ProfessionalMetric[]>> =>
  withReadClient('getDashboardProfessionalsData', async (supabase) => {
    try {
      const { data: professionalRows, error: professionalError } = await supabase
        .from('professionals')
        .select('id, full_name, position, status, health_unit_id, health_units!inner(id, name, status)')
        .eq('status', 'active')
        .eq('health_units.status', 'active')
        .order('full_name');

      if (professionalError) {
        return { data: [], error: normalizeError(professionalError) };
      }

      const activeProfessionals = ((professionalRows || []) as ProfessionalQueryRow[])
        .map((professional) => ({
          ...professional,
          health_unit: asSingle(professional.health_units),
        }))
        .filter((professional) => professional.health_unit?.id && professional.health_unit?.name);

      if (!activeProfessionals.length) {
        return { data: [], error: null };
      }

      const professionalIds = activeProfessionals.map((professional) => professional.id);

      const { data: evaluationProfessionalRows, error: evaluationProfessionalError } = await supabase
        .from('evaluation_professionals')
        .select('professional_id, score, evaluations!inner(id, attendance_date, patient_id, health_unit_id, created_by)')
        .in('professional_id', professionalIds);

      if (evaluationProfessionalError) {
        return { data: [], error: normalizeError(evaluationProfessionalError) };
      }

      const evaluationRows = ((evaluationProfessionalRows || []) as EvaluationProfessionalRow[])
        .map((row) => ({
          professional_id: row.professional_id,
          score: safeNumber(row.score),
          evaluation: asSingle(row.evaluations),
        }))
        .filter((row) => row.evaluation?.id);

      if (!evaluationRows.length) {
        return { data: [], error: null };
      }

      const patientIds = Array.from(new Set(evaluationRows.map((row) => row.evaluation?.patient_id).filter(Boolean))) as string[];
      const healthUnitIds = Array.from(new Set(evaluationRows.map((row) => row.evaluation?.health_unit_id).filter(Boolean))) as string[];
      const profileIds = Array.from(new Set(evaluationRows.map((row) => row.evaluation?.created_by).filter(Boolean))) as string[];

      const [patientsResult, unitsResult, profilesResult] = await Promise.all([
        patientIds.length
          ? supabase.from('patients').select('id').eq('status', 'active').in('id', patientIds)
          : Promise.resolve({ data: [], error: null }),
        healthUnitIds.length
          ? supabase.from('health_units').select('id').eq('status', 'active').in('id', healthUnitIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase.from('profiles').select('id').eq('status', 'active').in('id', profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const relationError = firstError([patientsResult, unitsResult, profilesResult] as QueryResult<unknown>[]);
      if (relationError) {
        return { data: [], error: relationError };
      }

      const activePatients = new Set((patientsResult.data || []).map((patient) => patient.id));
      const activeUnits = new Set((unitsResult.data || []).map((unit) => unit.id));
      const activeProfiles = new Set((profilesResult.data || []).map((profile) => profile.id));
      const professionalMap = new Map(activeProfessionals.map((professional) => [professional.id, professional]));
      const aggregates = new Map<string, { total: number; sum: number; lastEvaluationDate: string | null }>();

      for (const row of evaluationRows) {
        const evaluation = row.evaluation;
        if (!evaluation) continue;

        const professional = professionalMap.get(row.professional_id);
        if (!professional) continue;
        if (!activePatients.has(evaluation.patient_id)) continue;
        if (!activeUnits.has(evaluation.health_unit_id)) continue;
        if (evaluation.created_by && !activeProfiles.has(evaluation.created_by)) continue;

        const current = aggregates.get(row.professional_id) || { total: 0, sum: 0, lastEvaluationDate: null };
        current.total += 1;
        current.sum += row.score;
        current.lastEvaluationDate =
          !current.lastEvaluationDate || evaluation.attendance_date > current.lastEvaluationDate
            ? evaluation.attendance_date
            : current.lastEvaluationDate;
        aggregates.set(row.professional_id, current);
      }

      const professionals = activeProfessionals.reduce<ProfessionalMetric[]>((result, professional) => {
        const aggregate = aggregates.get(professional.id);

        if (!aggregate || aggregate.total <= 0) {
          return result;
        }

        result.push({
          professional_id: professional.id,
          professional_name: professional.full_name,
          position: professional.position,
          health_unit_id: professional.health_unit_id,
          health_unit_name: professional.health_unit?.name || 'Unidade nao informada',
          professional_status: 'active',
          health_unit_status: 'active',
          total_evaluations: aggregate.total,
          avg_professional_score: Number((aggregate.sum / aggregate.total).toFixed(2)),
          last_evaluation_date: aggregate.lastEvaluationDate,
        });

        return result;
      }, []);

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

const fetchRecentNotes = cache(async (): Promise<DashboardSectionResult<EvaluationNote[]>> =>
  withReadClient('getDashboardNotesData', async (supabase) => {
    try {
      const notes: EvaluationNote[] = [];
      const seenIds = new Set<string>();

      for (let page = 0; page < RECENT_NOTES_MAX_PAGES && notes.length < RECENT_NOTES_LIMIT; page += 1) {
        const from = page * RECENT_NOTES_PAGE_SIZE;
        const to = from + RECENT_NOTES_PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('evaluations')
          .select(`
            id,
            attendance_date,
            manifestation,
            general_score,
            general_notes,
            created_at,
            patients!inner(id, full_name, status),
            health_units!inner(id, name, status)
          `)
          .not('general_notes', 'is', null)
          .eq('patients.status', 'active')
          .eq('health_units.status', 'active')
          .order('created_at', { ascending: false })
          .order('attendance_date', { ascending: false })
          .range(from, to);

        if (error) {
          return { data: [], error: normalizeError(error) };
        }

        const rows = (data || []) as EvaluationNoteQueryRow[];

        if (!rows.length) {
          break;
        }

        for (const row of rows) {
          if (seenIds.has(row.id)) {
            continue;
          }

          const patient = asSingle(row.patients);
          const healthUnit = asSingle(row.health_units);
          const generalNotes = row.general_notes?.trim() || '';

          if (!generalNotes || !patient?.id || !patient.full_name || !healthUnit?.id || !healthUnit.name) {
            continue;
          }

          seenIds.add(row.id);
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

          if (notes.length >= RECENT_NOTES_LIMIT) {
            break;
          }
        }

        if (rows.length < RECENT_NOTES_PAGE_SIZE) {
          break;
        }
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

export const getDashboardSummaryData = cache(async (): Promise<DashboardSectionResult<UnitMetric[]>> => {
  const result = await fetchUnitMetrics();
  logDashboardError('units', result.error);
  return result;
});

export const getDashboardChartData = cache(async (): Promise<{ monthly: CityMonthlyMetric[]; units: UnitMetric[]; error: QueryError }> => {
  const [monthlyResult, unitsResult] = await Promise.all([fetchMonthlyMetrics(), fetchUnitMetrics()]);
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

export const getDashboardProfessionalsData = cache(async (): Promise<{ professionals: ProfessionalMetric[]; error: QueryError }> => {
  const result = await fetchProfessionalMetrics();
  logDashboardError('professionals', result.error);
  return { professionals: result.data.slice(0, 5), error: result.error };
});

export const getDashboardNotesData = cache(async (): Promise<{ notes: EvaluationNote[]; error: QueryError }> => {
  const result = await fetchRecentNotes();
  logDashboardError('notes', result.error);
  return { notes: result.data, error: result.error };
});

export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const [unitsResult, monthlyResult, professionalsResult, notesResult] = await Promise.all([
    fetchUnitMetrics(),
    fetchMonthlyMetrics(),
    fetchProfessionalMetrics(),
    fetchRecentNotes(),
  ]);

  logDashboardError('units', unitsResult.error);
  logDashboardError('monthly', monthlyResult.error);
  logDashboardError('professionals', professionalsResult.error);
  logDashboardError('notes', notesResult.error);

  return {
    units: unitsResult.data,
    monthly: monthlyResult.data,
    highlightedProfessionals: professionalsResult.data.slice(0, 5),
    notes: notesResult.data,
    errors: {
      units: unitsResult.error,
      monthly: monthlyResult.error,
      professionals: professionalsResult.error,
      notes: notesResult.error,
    },
  };
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

export async function searchPatients(search: string) {
  const normalized = normalizeSearchQuery(search);
  if (normalized.length < 2) return [];

  return withReadClient('searchPatients', async (supabase) => {
    const digits = normalized.replace(/\D/g, '');

    const [nameResult, cpfResult] = await Promise.all([
      supabase
        .from('patients')
        .select('id, full_name, cpf')
        .eq('status', 'active')
        .ilike('full_name', `%${normalized}%`)
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

export const getRankingData = cache(async (): Promise<RankingData> => {
  const [unitsResult, professionalsResult] = await Promise.all([fetchUnitMetrics(), fetchProfessionalMetrics()]);

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
