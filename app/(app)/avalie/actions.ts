'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type EvaluationProfessionalInsert = {
  evaluation_id: string;
  professional_id: string;
  score: number;
};

function numberValue(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function optionalText(value: FormDataEntryValue | null) {
  const text = textValue(value);
  return text || null;
}

function digitsOnly(value: FormDataEntryValue | null) {
  const digits = textValue(value).replace(/\D/g, '');
  return digits || null;
}

function errorTarget(message: string) {
  return `/avalie?error=${encodeURIComponent(message)}`;
}

async function resolvePatientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  userId: string | null,
) {
  const patientMode = textValue(formData.get('patient_mode')) || 'existing';

  if (patientMode === 'existing') {
    const patientId = textValue(formData.get('patient_id'));
    if (!patientId) throw new Error('Selecione um paciente cadastrado ou use a opção Novo paciente.');
    return patientId;
  }

  const fullName = textValue(formData.get('new_patient_full_name'));
  const cpf = digitsOnly(formData.get('new_patient_cpf'));

  if (!fullName || fullName.length < 3) {
    throw new Error('Informe o nome completo do paciente.');
  }

  if (cpf && cpf.length !== 11) {
    throw new Error('Informe um CPF válido com 11 números ou deixe o campo em branco.');
  }

  if (cpf) {
    const { data: existingPatient, error: existingError } = await supabase
      .from('patients')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existingPatient?.id) return existingPatient.id as string;
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      full_name: fullName,
      cpf,
      birth_date: optionalText(formData.get('new_patient_birth_date')),
      phone: optionalText(formData.get('new_patient_phone')),
      whatsapp: optionalText(formData.get('new_patient_whatsapp')),
      address: optionalText(formData.get('new_patient_address')),
      neighborhood: optionalText(formData.get('new_patient_neighborhood')),
      status: 'active',
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !patient?.id) {
    throw new Error(error?.message || 'Não foi possível cadastrar o paciente durante a avaliação.');
  }

  return patient.id as string;
}

export async function createEvaluationAction(formData: FormData) {
  let target = '/avalie?success=1';

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;
    const professionalIds = formData.getAll('professional_ids').map(String).filter(Boolean);
    const patientId = await resolvePatientId(supabase, formData, userId);

    const payload = {
      patient_id: patientId,
      health_unit_id: textValue(formData.get('health_unit_id')),
      attendance_date: textValue(formData.get('attendance_date')),
      contact_type: textValue(formData.get('contact_type')) || 'in_person',
      wait_time_minutes: numberValue(formData.get('wait_time_minutes')),
      resolution: textValue(formData.get('resolution')) || 'partial',
      general_score: numberValue(formData.get('general_score')),
      satisfaction_score: numberValue(formData.get('satisfaction_score')),
      structure_score: numberValue(formData.get('structure_score')),
      clarity_score: numberValue(formData.get('clarity_score')),
      service_quality_score: numberValue(formData.get('service_quality_score')),
      manifestation: textValue(formData.get('manifestation')) || 'neutral',
      general_notes: optionalText(formData.get('general_notes')),
      created_by: userId,
    };

    const hasRequiredScores = [
      payload.general_score,
      payload.satisfaction_score,
      payload.structure_score,
      payload.clarity_score,
      payload.service_quality_score,
    ].every((value) => value !== null && value >= 0 && value <= 10);

    if (!payload.health_unit_id || !payload.attendance_date) {
      target = errorTarget('Preencha unidade e data do atendimento.');
    } else if (!hasRequiredScores) {
      target = errorTarget('Informe todas as notas gerais entre 0 e 10.');
    } else {
      const { data: evaluation, error } = await supabase.from('evaluations').insert(payload).select('id').single();

      if (error || !evaluation) {
        target = errorTarget(error?.message || 'Não foi possível salvar a avaliação.');
      } else {
        const professionalRows = professionalIds
          .map((professionalId): EvaluationProfessionalInsert | null => {
            const score = numberValue(formData.get(`score_${professionalId}`));
            if (score === null || score < 0 || score > 10) return null;
            return { evaluation_id: evaluation.id, professional_id: professionalId, score };
          })
          .filter((row): row is EvaluationProfessionalInsert => row !== null);

        if (professionalRows.length) {
          const { error: professionalsError } = await supabase.from('evaluation_professionals').insert(professionalRows);

          if (professionalsError) {
            target = errorTarget(professionalsError.message);
          }
        }

        if (target.includes('success')) {
          revalidateTag('dashboard-data');
          revalidateTag('ranking-data');
          revalidateTag('reference-data');
          revalidatePath('/painel');
          revalidatePath('/ranking');
          revalidatePath('/cadastros/pacientes');
        }
      }
    }
  } catch (error) {
    target = errorTarget(error instanceof Error ? error.message : 'Não foi possível salvar a avaliação no momento. Confira a conexão e as permissões do Supabase.');
  }

  redirect(target);
}
