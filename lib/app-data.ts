import { unstable_cache } from 'next/cache';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { CityMonthlyMetric, EvaluationNote, HealthUnit, Patient, Professional, ProfessionalMetric, UnitMetric } from '@/types';

type SupabaseClientLike = ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>;

type QueryError = {
  message: string;
  code?: string;
  status?: number;
  details?: string | null;
  hint?: string | null;
} | null;

type QueryResult<T> = {
  data: T[] | null;
  error: QueryError;
};

export type DashboardData = {
  units: UnitMetric[];
  monthly: CityMonthlyMetric[];
  highlightedProfessionals: ProfessionalMetric[];
  notes: EvaluationNote[];
  error: QueryError;
  notesError: QueryError;
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

function firstError(results: QueryResult<unknown>[]) {
  return results.find((result) => result.error)?.error || null;
}

async function getReadClient(): Promise<SupabaseClientLike> {
  if (isAdminClientConfigured()) return createAdminClient();
  return createClient();
}

async function fetchRecentNotes(supabase: SupabaseClientLike): Promise<{ notes: EvaluationNote[]; error: QueryError }> {
  const { data: evaluations, error } = await supabase
    .from('evaluations')
    .select('id, patient_id, health_unit_id, attendance_date, manifestation, general_score, general_notes, created_at')
    .not('general_notes', 'is', null)
    .neq('general_notes', '')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) return { notes: [], error };

  const rows = evaluations || [];
  if (!rows.length) return { notes: [], error: null };

  const patientIds = Array.from(new Set(rows.map((row) => row.patient_id).filter(Boolean)));
  const unitIds = Array.from(new Set(rows.map((row) => row.health_unit_id).filter(Boolean)));

  const [patientsResult, unitsResult] = await Promise.all([
    patientIds.length ? supabase.from('patients').select('id, full_name').in('id', patientIds) : Promise.resolve({ data: [], error: null }),
    unitIds.length ? supabase.from('health_units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const relationError = patientsResult.error || unitsResult.error || null;
  const patientMap = new Map((patientsResult.data || []).map((patient) => [patient.id, patient.full_name]));
  const unitMap = new Map((unitsResult.data || []).map((unit) => [unit.id, unit.name]));

  const notes = rows.map((row) => ({
    id: row.id,
    attendance_date: row.attendance_date,
    manifestation: row.manifestation,
    general_score: row.general_score,
    general_notes: row.general_notes,
    patient_name: patientMap.get(row.patient_id) || 'Paciente não identificado',
    health_unit_name: unitMap.get(row.health_unit_id) || 'Unidade não identificada',
    created_at: row.created_at,
  }));

  return { notes, error: relationError };
}

async function fetchDashboardDataWith(supabase: SupabaseClientLike): Promise<DashboardData> {
  const [unitsResult, monthlyResult, professionalsResult, notesResult] = await Promise.all([
    supabase
      .from('v_unit_metrics')
      .select('health_unit_id, health_unit_name, health_unit_type, total_evaluations, avg_general_score, avg_satisfaction_score, resolution_rate, avg_wait_time_minutes')
      .order('avg_general_score', { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from('v_city_monthly_metrics').select('month, avg_general_score').order('month', { ascending: false }).limit(12),
    supabase
      .from('v_professional_metrics')
      .select('professional_id, professional_name, position, health_unit_name, total_evaluations, avg_professional_score')
      .order('avg_professional_score', { ascending: false, nullsFirst: false })
      .limit(5),
    fetchRecentNotes(supabase),
  ]);

  const error = firstError([unitsResult, monthlyResult, professionalsResult] as QueryResult<unknown>[]);

  return {
    units: (unitsResult.data || []) as UnitMetric[],
    monthly: [...((monthlyResult.data || []) as CityMonthlyMetric[])].reverse(),
    highlightedProfessionals: (professionalsResult.data || []) as ProfessionalMetric[],
    notes: notesResult.notes,
    error,
    notesError: notesResult.error,
  };
}

const fetchCachedDashboardData = unstable_cache(
  async () => fetchDashboardDataWith(createAdminClient()),
  ['avalia-saude-dashboard-data-v4'],
  { revalidate: 20, tags: ['dashboard-data'] },
);

export async function getDashboardData() {
  if (isAdminClientConfigured()) return fetchCachedDashboardData();
  return fetchDashboardDataWith(await getReadClient());
}

async function fetchEvaluationFormDataWith(supabase: SupabaseClientLike): Promise<EvaluationFormData> {
  const results = await Promise.all([
    supabase.from('patients').select('id, full_name, cpf').eq('status', 'active').order('created_at', { ascending: false }).limit(100),
    supabase.from('health_units').select('id, name').eq('status', 'active').order('name'),
    supabase.from('professionals').select('id, full_name, position, health_unit_id, work_schedule').eq('status', 'active').order('full_name'),
  ]);

  return {
    patients: (results[0].data || []) as EvaluationFormData['patients'],
    units: (results[1].data || []) as EvaluationFormData['units'],
    professionals: (results[2].data || []) as EvaluationFormData['professionals'],
    error: firstError(results as QueryResult<unknown>[]),
  };
}

const fetchCachedEvaluationFormData = unstable_cache(
  async () => fetchEvaluationFormDataWith(createAdminClient()),
  ['avalia-saude-evaluation-form-data-v3'],
  { revalidate: 20, tags: ['reference-data'] },
);

export async function getEvaluationFormData() {
  if (isAdminClientConfigured()) return fetchCachedEvaluationFormData();
  return fetchEvaluationFormDataWith(await getReadClient());
}

async function fetchRankingDataWith(supabase: SupabaseClientLike): Promise<RankingData> {
  const results = await Promise.all([
    supabase.from('v_unit_metrics').select('health_unit_id, health_unit_name, health_unit_type, total_evaluations, avg_general_score').gt('total_evaluations', 0).order('avg_general_score', { ascending: false }).limit(10),
    supabase.from('v_unit_metrics').select('health_unit_id, health_unit_name, health_unit_type, total_evaluations, avg_general_score').gt('total_evaluations', 0).order('avg_general_score', { ascending: true }).limit(10),
    supabase.from('v_professional_metrics').select('professional_id, professional_name, position, health_unit_name, total_evaluations, avg_professional_score').gt('total_evaluations', 0).order('avg_professional_score', { ascending: false }).limit(10),
    supabase.from('v_professional_metrics').select('professional_id, professional_name, position, health_unit_name, total_evaluations, avg_professional_score').gt('total_evaluations', 0).order('avg_professional_score', { ascending: true }).limit(10),
  ]);

  return {
    bestUnits: (results[0].data || []) as UnitMetric[],
    worstUnits: (results[1].data || []) as UnitMetric[],
    bestProfessionals: (results[2].data || []) as ProfessionalMetric[],
    worstProfessionals: (results[3].data || []) as ProfessionalMetric[],
    error: firstError(results as QueryResult<unknown>[]),
  };
}

const fetchCachedRankingData = unstable_cache(
  async () => fetchRankingDataWith(createAdminClient()),
  ['avalia-saude-ranking-data-v3'],
  { revalidate: 20, tags: ['ranking-data'] },
);

export async function getRankingData() {
  if (isAdminClientConfigured()) return fetchCachedRankingData();
  return fetchRankingDataWith(await getReadClient());
}
