'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

type EvaluationProfessionalInsert = {
  evaluation_id: string;
  professional_id: string;
  score: number;
};

function numberValue(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function createEvaluationAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const professionalIds = formData.getAll('professional_ids').map(String).filter(Boolean);

  const payload = {
    patient_id: String(formData.get('patient_id') || ''),
    health_unit_id: String(formData.get('health_unit_id') || ''),
    attendance_date: String(formData.get('attendance_date') || ''),
    contact_type: String(formData.get('contact_type') || 'in_person'),
    wait_time_minutes: numberValue(formData.get('wait_time_minutes')),
    resolution: String(formData.get('resolution') || 'partial'),
    general_score: numberValue(formData.get('general_score')),
    satisfaction_score: numberValue(formData.get('satisfaction_score')),
    structure_score: numberValue(formData.get('structure_score')),
    clarity_score: numberValue(formData.get('clarity_score')),
    service_quality_score: numberValue(formData.get('service_quality_score')),
    manifestation: String(formData.get('manifestation') || 'neutral'),
    general_notes: String(formData.get('general_notes') || '').trim() || null,
    created_by: user?.id || null,
  };

  if (!payload.patient_id || !payload.health_unit_id || !payload.attendance_date) {
    redirect('/avalie?error=Preencha paciente, unidade e data do atendimento.');
  }

  const { data: evaluation, error } = await supabase
    .from('evaluations')
    .insert(payload)
    .select('id')
    .single();

  if (error || !evaluation) {
    redirect(`/avalie?error=${encodeURIComponent(error?.message || 'Não foi possível salvar a avaliação.')}`);
  }

  const professionalRows = professionalIds
    .map((professionalId): EvaluationProfessionalInsert | null => {
      const score = numberValue(formData.get(`score_${professionalId}`));
      if (score === null) return null;
      return {
        evaluation_id: evaluation.id,
        professional_id: professionalId,
        score,
      };
    })
    .filter((row): row is EvaluationProfessionalInsert => row !== null);

  if (professionalRows.length) {
    const { error: professionalsError } = await supabase
      .from('evaluation_professionals')
      .insert(professionalRows);

    if (professionalsError) {
      redirect(`/avalie?error=${encodeURIComponent(professionalsError.message)}`);
    }
  }

  redirect('/avalie?success=1');
}