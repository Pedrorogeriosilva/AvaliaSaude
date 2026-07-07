export type AppRole = 'admin' | 'operator' | 'viewer';
export type RecordStatus = 'active' | 'inactive';
export type HealthUnitType = 'psf' | 'hospital' | 'other';
export type ContactType = 'phone' | 'whatsapp' | 'in_person';
export type ResolutionStatus = 'resolved' | 'partial' | 'unresolved';
export type ManifestationType = 'praise' | 'complaint' | 'suggestion' | 'neutral';

export type Patient = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  neighborhood: string | null;
  status: RecordStatus;
  created_at: string;
};

export type HealthUnit = {
  id: string;
  name: string;
  type: HealthUnitType;
  address: string;
  neighborhood: string | null;
  phone: string | null;
  manager_name: string | null;
  status: RecordStatus;
};

export type Professional = {
  id: string;
  full_name: string;
  position: string;
  professional_license: string | null;
  health_unit_id: string;
  work_schedule: string | null;
  status: RecordStatus;
  health_units?: { name: string } | null;
};

export type UnitMetric = {
  health_unit_id: string;
  health_unit_name: string;
  health_unit_type: HealthUnitType;
  total_evaluations: number | string | null;
  avg_general_score: number | string | null;
  avg_satisfaction_score: number | string | null;
  resolution_rate: number | string | null;
  avg_wait_time_minutes: number | string | null;
};

export type CityMonthlyMetric = {
  month: string;
  avg_general_score: number | string | null;
};

export type ProfessionalMetric = {
  professional_id: string;
  professional_name: string;
  position: string;
  health_unit_name: string;
  total_evaluations: number | string | null;
  avg_professional_score: number | string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  status: RecordStatus;
  created_at: string;
};