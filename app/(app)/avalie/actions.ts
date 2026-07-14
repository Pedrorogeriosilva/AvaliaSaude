'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertCanCreateEvaluation } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFriendlyErrorMessage } from '@/lib/supabase/errors';
import {
  CONTACT_TYPES,
  MANIFESTATION_TYPES,
  RESOLUTION_STATUSES,
  cleanText,
  digitsOnly,
  isFutureDate,
  isValidCpfFormat,
  isValidDate,
  isValidEnum,
  isValidUuid,
  optionalText,
  parseNonNegativeInteger,
  parseScore,
} from '@/lib/validation';

type EvaluationProfessionalInsert = {
  evaluation_id: string;
  professional_id: string;
  score: number;
};

const INACTIVE_RECORD_MESSAGE = 'Não é possível registrar avaliação com paciente, unidade, profissional ou usuário inativo.';

function errorTarget(message: string) {
  return `/avalie?error=${encodeURIComponent(getFriendlyErrorMessage(message))}`;
}

async function resolvePatientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  userId: string,
) {
  const patientMode = cleanText(formData.get('patient_mode'), 12) || 'existing';

  if (patientMode === 'existing') {
    const patientId = cleanText(formData.get('patient_id'), 40);
    if (!isValidUuid(patientId)) {
      throw new Error('Selecione um paciente cadastrado válido ou use a opção Novo paciente.');
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, status')
      .eq('id', patientId)
      .maybeSingle();
    if (error || !patient) {
      throw new Error('Paciente não encontrado.');
    }
    if (patient.status !== 'active') {
      throw new Error(INACTIVE_RECORD_MESSAGE);
    }

    return patientId;
  }

  const fullName = cleanText(formData.get('new_patient_full_name'), 120);
  const cpf = digitsOnly(formData.get('new_patient_cpf'), 11);
  const birthDate = optionalText(formData.get('new_patient_birth_date'), 10);
  const phone = optionalText(formData.get('new_patient_phone'), 30);
  const whatsapp = optionalText(formData.get('new_patient_whatsapp'), 30);
  const address = optionalText(formData.get('new_patient_address'), 200);
  const neighborhood = optionalText(formData.get('new_patient_neighborhood'), 100);

  if (fullName.length < 3) {
    throw new Error('Informe o nome completo do paciente.');
  }

  if (cpf && !isValidCpfFormat(cpf)) {
    throw new Error('Informe um CPF válido com 11 números ou deixe o campo em branco.');
  }

  if (birthDate && !isValidDate(birthDate)) {
    throw new Error('Informe uma data de nascimento válida.');
  }

  if (cpf) {
    const { data: existingPatient, error: existingError } = await supabase
      .from('patients')
      .select('id, status')
      .eq('cpf', cpf)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existingPatient?.status === 'inactive') {
      throw new Error(INACTIVE_RECORD_MESSAGE);
    }
    if (existingPatient?.id) return existingPatient.id as string;
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      full_name: fullName,
      cpf: cpf || null,
      birth_date: birthDate,
      phone,
      whatsapp,
      address,
      neighborhood,
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
    const currentProfile = await assertCanCreateEvaluation();
    const supabase = await createClient();

    const healthUnitId = cleanText(formData.get('health_unit_id'), 40);
    const attendanceDate = cleanText(formData.get('attendance_date'), 10);
    const contactType = cleanText(formData.get('contact_type'), 20) || 'in_person';
    const waitTimeMinutes = parseNonNegativeInteger(formData.get('wait_time_minutes'));
    const resolution = cleanText(formData.get('resolution'), 20) || 'partial';
    const manifestation = cleanText(formData.get('manifestation'), 20) || 'neutral';
    const generalNotes = optionalText(formData.get('general_notes'), 2000);
    const professionalIds = formData.getAll('professional_ids').map(String).filter(Boolean);

    const payload = {
      patient_id: await resolvePatientId(supabase, formData, currentProfile.id),
      health_unit_id: healthUnitId,
      attendance_date: attendanceDate,
      contact_type: contactType,
      wait_time_minutes: waitTimeMinutes,
      resolution,
      general_score: parseScore(formData.get('general_score')),
      satisfaction_score: parseScore(formData.get('satisfaction_score')),
      structure_score: parseScore(formData.get('structure_score')),
      clarity_score: parseScore(formData.get('clarity_score')),
      service_quality_score: parseScore(formData.get('service_quality_score')),
      manifestation,
      general_notes: generalNotes,
      created_by: currentProfile.id,
    };

    if (!isValidUuid(payload.health_unit_id)) {
      target = errorTarget('Selecione uma unidade válida.');
    } else if (!isValidDate(payload.attendance_date)) {
      target = errorTarget('Informe uma data de atendimento válida.');
    } else if (isFutureDate(payload.attendance_date)) {
      target = errorTarget('A data do atendimento não pode ser futura.');
    } else if (!isValidEnum(payload.contact_type, CONTACT_TYPES)) {
      target = errorTarget('Tipo de contato inválido. Selecione uma opção válida.');
    } else if (!isValidEnum(payload.resolution, RESOLUTION_STATUSES)) {
      target = errorTarget('Resolução inválida. Selecione uma opção válida.');
    } else if (!isValidEnum(payload.manifestation, MANIFESTATION_TYPES)) {
      target = errorTarget('Tipo de manifestação inválido. Selecione uma opção válida.');
    } else if (
      payload.general_score === null ||
      payload.satisfaction_score === null ||
      payload.structure_score === null ||
      payload.clarity_score === null ||
      payload.service_quality_score === null
    ) {
      target = errorTarget('Informe todas as notas gerais entre 0 e 10.');
    } else {
      const [unitResult, selectedProfessionalsResult] = await Promise.all([
        supabase
          .from('health_units')
          .select('id, status')
          .eq('id', payload.health_unit_id)
          .maybeSingle(),
        professionalIds.length
          ? supabase
              .from('professionals')
              .select('id, health_unit_id, status')
              .in('id', professionalIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (unitResult.error || !unitResult.data) {
        target = errorTarget('Unidade não encontrada.');
      } else if (unitResult.data.status !== 'active') {
        target = errorTarget(INACTIVE_RECORD_MESSAGE);
      } else if (selectedProfessionalsResult.error) {
        target = errorTarget(selectedProfessionalsResult.error.message);
      } else {
        const validProfessionals = selectedProfessionalsResult.data || [];
        const validProfessionalIds = new Set(
          validProfessionals
            .filter(
              (professional) =>
                professional.health_unit_id === payload.health_unit_id &&
                professional.status === 'active',
            )
            .map((professional) => professional.id),
        );

        if (validProfessionals.some((professional) => professional.status !== 'active')) {
          target = errorTarget(INACTIVE_RECORD_MESSAGE);
        }

        const professionalRows = professionalIds
          .map((professionalId): EvaluationProfessionalInsert | null => {
            if (!isValidUuid(professionalId) || !validProfessionalIds.has(professionalId)) return null;
            const score = parseScore(formData.get(`score_${professionalId}`));
            if (score === null) return null;
            return { evaluation_id: '', professional_id: professionalId, score };
          });

        const hasInvalidProfessionalScore = professionalIds.length > 0 && professionalRows.some((row) => row === null);

        if (target.includes('error=')) {
          // mantém a mensagem amigável já definida acima
        } else if (hasInvalidProfessionalScore) {
          target = errorTarget('Informe notas individuais válidas entre 0 e 10 para os profissionais selecionados.');
        } else {
          const { data: evaluation, error } = await supabase.from('evaluations').insert(payload).select('id').single();

          if (error || !evaluation) {
            target = errorTarget(error?.message || 'Não foi possível salvar a avaliação.');
          } else {
            const professionalRowsToInsert = professionalRows
              .filter((row): row is EvaluationProfessionalInsert => row !== null)
              .map((row) => ({ ...row, evaluation_id: evaluation.id }));

            if (professionalRowsToInsert.length) {
              const { error: professionalsError } = await supabase
                .from('evaluation_professionals')
                .insert(professionalRowsToInsert);

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
      }
    }
  } catch (error) {
    target = errorTarget(error instanceof Error ? error.message : 'Não foi possível salvar a avaliação no momento.');
  }

  redirect(target);
}
