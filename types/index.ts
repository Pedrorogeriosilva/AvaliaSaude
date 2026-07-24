export type AppRole = 'admin' | 'operator' | 'viewer';
export type RecordStatus = 'active' | 'inactive';

export type City = {
  id: string;
  name: string;
  state_uf: string;
  status: RecordStatus;
  created_at?: string;
};
export type HealthUnitType = 'psf' | 'hospital' | 'other';
export type ContactType = 'phone' | 'whatsapp' | 'in_person';
export type ResolutionStatus = 'resolved' | 'partial' | 'unresolved';
export type ManifestationType = 'praise' | 'complaint' | 'suggestion' | 'neutral';

export type Patient = {
  id: string;
  full_name: string;
  cpf: string | null;
  city_id?: string | null;
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
  city_id?: string | null;
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
  health_unit_status?: RecordStatus;
  city_id?: string | null;
  total_evaluations: number | string | null;
  avg_general_score: number | string | null;
  avg_structure_score?: number | string | null;
  avg_wait_time_score?: number | string | null;
  resolution_rate: number | string | null;
  last_evaluation_date?: string | null;
};

export type CityMonthlyMetric = {
  month: string;
  avg_general_score: number | string | null;
};


export type EvaluationNote = {
  id: string;
  attendance_date: string;
  manifestation: ManifestationType | string | null;
  general_score: number | string | null;
  general_notes: string | null;
  patient_name: string;
  health_unit_name: string;
  created_at: string;
};

export type ProfessionalMetric = {
  professional_id: string;
  professional_name: string;
  position: string;
  health_unit_id?: string;
  health_unit_name: string;
  city_id?: string | null;
  professional_status?: RecordStatus;
  health_unit_status?: RecordStatus;
  total_evaluations: number | string | null;
  avg_professional_score: number | string | null;
  last_evaluation_date?: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  status: RecordStatus;
  is_master?: boolean;
  city_id?: string | null;
  created_at: string;
};
