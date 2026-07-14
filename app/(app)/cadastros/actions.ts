'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  assertCanDeletePatients,
  assertCanManagePatients,
  assertCanManageProfessionals,
  assertCanManageUnits,
  assertCanManageUsers,
} from '@/lib/auth';
import {
  clearUserManagementGateFailures,
  getUserManagementUnlockCooldown,
  isUserManagementGateUnlocked,
  registerUserManagementGateFailure,
  unlockUserManagementGate,
  validateAdminCreationPasswordValue,
} from '@/lib/admin-gate';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { getFriendlyErrorMessage } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import {
  APP_ROLES,
  HEALTH_UNIT_TYPES,
  RECORD_STATUSES,
  assertMaxLength,
  cleanText,
  digitsOnly,
  isValidCpfFormat,
  isValidDate,
  isValidEmail,
  isValidEnum,
  isValidUuid,
  optionalText,
} from '@/lib/validation';

const PATIENTS_PATH = '/cadastros/pacientes';
const UNITS_PATH = '/cadastros/unidades';
const PROFESSIONALS_PATH = '/cadastros/profissionais';
const USERS_PATH = '/cadastros/usuarios';

function target(path: string, message: string) {
  return `${path}?error=${encodeURIComponent(getFriendlyErrorMessage(message))}`;
}

function successTarget(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function revalidateOperationalData(...paths: string[]) {
  revalidateTag('reference-data');
  revalidateTag('dashboard-data');
  revalidateTag('ranking-data');
  paths.forEach((path) => revalidatePath(path));
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

function ensureUuid(value: string, message: string) {
  if (!isValidUuid(value)) {
    throw new Error(message);
  }
}

function validateFullName(value: string, label: string) {
  if (value.length < 3 || value.length > 120) {
    throw new Error(`Informe ${label} com 3 a 120 caracteres.`);
  }
}

function validateOptionalPhone(value: string | null) {
  if (value && !assertMaxLength(value, 30)) {
    throw new Error('Telefone ou WhatsApp muito longo.');
  }
}

function validateOptionalCpf(value: string) {
  if (!value) return;
  if (!isValidCpfFormat(value)) {
    throw new Error('Informe um CPF válido com 11 números ou deixe o campo em branco.');
  }
}

function validateAddress(value: string) {
  if (value.length < 5 || value.length > 200) {
    throw new Error('Informe um endereço com 5 a 200 caracteres.');
  }
}

async function ensureHealthUnitExists(healthUnitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_units')
    .select('id')
    .eq('id', healthUnitId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Unidade de saúde não encontrada.');
  }
}

async function ensurePatientExists(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Paciente não encontrado.');
  }
}

async function ensureProfessionalExists(professionalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('professionals')
    .select('id')
    .eq('id', professionalId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Profissional não encontrado.');
  }
}

async function getValidatedAdminClient() {
  if (!isAdminClientConfigured()) {
    throw new Error('A configuração do servidor está incompleta.');
  }
  return createAdminClient();
}

async function validateUserManagementGate() {
  const profile = await assertCanManageUsers();
  const isUnlocked = await isUserManagementGateUnlocked(profile.id);

  if (!isUnlocked) {
    throw new Error('Informe a senha adicional antes de acessar a gestão de usuários.');
  }

  return profile;
}

function validateStatus(status: string, label: string) {
  if (!isValidEnum(status, RECORD_STATUSES)) {
    throw new Error(`${label} inválido.`);
  }
}

export async function createPatientAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentProfile = await assertCanManagePatients();
    const fullName = cleanText(formData.get('full_name'), 120);
    const cpf = digitsOnly(formData.get('cpf'), 11);
    const birthDate = optionalText(formData.get('birth_date'), 10);
    const phone = optionalText(formData.get('phone'), 30);
    const whatsapp = optionalText(formData.get('whatsapp'), 30);
    const address = optionalText(formData.get('address'), 200);
    const neighborhood = optionalText(formData.get('neighborhood'), 100);

    validateFullName(fullName, 'o nome completo do paciente');
    validateOptionalCpf(cpf);
    validateOptionalPhone(phone);
    validateOptionalPhone(whatsapp);
    if (birthDate && !isValidDate(birthDate)) throw new Error('Informe uma data de nascimento válida.');

    const supabase = await createClient();
    const { error } = await supabase.from('patients').insert({
      full_name: fullName,
      cpf: cpf || null,
      birth_date: birthDate,
      phone,
      whatsapp,
      address,
      neighborhood,
      status: 'active',
      created_by: currentProfile.id || (await getUserId(supabase)),
    });

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível cadastrar o paciente.';
  }

  if (errorMessage) redirect(target(PATIENTS_PATH, errorMessage));
  revalidateOperationalData(PATIENTS_PATH, '/avalie');
  redirect(successTarget(PATIENTS_PATH, 'Paciente cadastrado com sucesso.'));
}

export async function togglePatientStatusAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManagePatients();
    const supabase = await createClient();
    const id = String(formData.get('id') || '');
    const status = String(formData.get('status') || '') === 'active' ? 'inactive' : 'active';

    ensureUuid(id, 'Paciente não identificado.');

    const { error } = await supabase.from('patients').update({ status }).eq('id', id);
    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar o paciente.';
  }

  if (errorMessage) redirect(target(PATIENTS_PATH, errorMessage));
  revalidateOperationalData(PATIENTS_PATH, '/avalie');
  redirect(successTarget(PATIENTS_PATH, 'Status do paciente atualizado com sucesso.'));
}

export async function updatePatientAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManagePatients();
    const id = String(formData.get('id') || '');
    const fullName = cleanText(formData.get('full_name'), 120);
    const cpf = digitsOnly(formData.get('cpf'), 11);
    const birthDate = optionalText(formData.get('birth_date'), 10);
    const phone = optionalText(formData.get('phone'), 30);
    const whatsapp = optionalText(formData.get('whatsapp'), 30);
    const address = optionalText(formData.get('address'), 200);
    const neighborhood = optionalText(formData.get('neighborhood'), 100);
    const status = cleanText(formData.get('status'), 20);

    ensureUuid(id, 'Paciente não identificado.');
    validateFullName(fullName, 'o nome completo do paciente');
    validateOptionalCpf(cpf);
    validateStatus(status, 'Status do paciente');
    validateOptionalPhone(phone);
    validateOptionalPhone(whatsapp);
    if (birthDate && !isValidDate(birthDate)) throw new Error('Informe uma data de nascimento válida.');

    const supabase = await createClient();
    const { error } = await supabase
      .from('patients')
      .update({
        full_name: fullName,
        cpf: cpf || null,
        birth_date: birthDate,
        phone,
        whatsapp,
        address,
        neighborhood,
        status,
      })
      .eq('id', id);

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível editar o paciente.';
  }

  if (errorMessage) redirect(target(PATIENTS_PATH, errorMessage));
  revalidateOperationalData(PATIENTS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PATIENTS_PATH, 'Paciente atualizado com sucesso.'));
}

export async function deletePatientAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanDeletePatients();
    const id = String(formData.get('id') || '');
    const confirmDelete = String(formData.get('confirm_delete') || '') === '1';

    ensureUuid(id, 'Paciente não identificado.');
    if (!confirmDelete) {
      throw new Error('Confirme a exclusão definitiva do paciente antes de continuar.');
    }

    const admin = await getValidatedAdminClient();
    const { data: evaluations, error: evaluationsError } = await admin
      .from('evaluations')
      .select('id')
      .eq('patient_id', id);

    if (evaluationsError) {
      errorMessage = evaluationsError.message;
    } else {
      const evaluationIds = (evaluations || []).map((evaluation) => evaluation.id as string);

      if (evaluationIds.length) {
        const { error: linkedError } = await admin
          .from('evaluation_professionals')
          .delete()
          .in('evaluation_id', evaluationIds);
        if (linkedError) errorMessage = linkedError.message;

        if (!errorMessage) {
          const { error: evaluationDeleteError } = await admin
            .from('evaluations')
            .delete()
            .in('id', evaluationIds);
          if (evaluationDeleteError) errorMessage = evaluationDeleteError.message;
        }
      }

      if (!errorMessage) {
        const { error } = await admin.from('patients').delete().eq('id', id);
        if (error) errorMessage = error.message;
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível excluir o paciente.';
  }

  if (errorMessage) redirect(target(PATIENTS_PATH, errorMessage));
  revalidateOperationalData(PATIENTS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PATIENTS_PATH, 'Paciente e avaliações vinculadas foram excluídos.'));
}

export async function createHealthUnitAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentProfile = await assertCanManageUnits();
    const name = cleanText(formData.get('name'), 120);
    const type = cleanText(formData.get('type'), 20);
    const address = cleanText(formData.get('address'), 200);
    const neighborhood = optionalText(formData.get('neighborhood'), 100);
    const phone = optionalText(formData.get('phone'), 30);
    const managerName = optionalText(formData.get('manager_name'), 120);

    validateFullName(name, 'o nome da unidade');
    validateAddress(address);
    validateOptionalPhone(phone);
    if (!isValidEnum(type, HEALTH_UNIT_TYPES)) throw new Error('Tipo de unidade inválido.');

    const supabase = await createClient();
    const { error } = await supabase.from('health_units').insert({
      name,
      type,
      address,
      neighborhood,
      phone,
      manager_name: managerName,
      status: 'active',
      created_by: currentProfile.id,
    });

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível cadastrar a unidade.';
  }

  if (errorMessage) redirect(target(UNITS_PATH, errorMessage));
  revalidateOperationalData(UNITS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(UNITS_PATH, 'Unidade cadastrada com sucesso.'));
}

export async function toggleHealthUnitStatusAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageUnits();
    const supabase = await createClient();
    const id = String(formData.get('id') || '');
    const status = String(formData.get('status') || '') === 'active' ? 'inactive' : 'active';

    ensureUuid(id, 'Unidade não identificada.');

    const { error } = await supabase.from('health_units').update({ status }).eq('id', id);
    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar a unidade.';
  }

  if (errorMessage) redirect(target(UNITS_PATH, errorMessage));
  revalidateOperationalData(UNITS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(UNITS_PATH, 'Status da unidade atualizado com sucesso.'));
}

export async function updateHealthUnitAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageUnits();
    const id = String(formData.get('id') || '');
    const name = cleanText(formData.get('name'), 120);
    const address = cleanText(formData.get('address'), 200);
    const type = cleanText(formData.get('type'), 20);
    const neighborhood = optionalText(formData.get('neighborhood'), 100);
    const phone = optionalText(formData.get('phone'), 30);
    const managerName = optionalText(formData.get('manager_name'), 120);
    const status = cleanText(formData.get('status'), 20);

    ensureUuid(id, 'Unidade não identificada.');
    validateFullName(name, 'o nome da unidade');
    validateAddress(address);
    validateOptionalPhone(phone);
    if (!isValidEnum(type, HEALTH_UNIT_TYPES)) throw new Error('Tipo de unidade inválido.');
    validateStatus(status, 'Status da unidade');

    const admin = await getValidatedAdminClient();
    const { error } = await admin
      .from('health_units')
      .update({
        name,
        type,
        address,
        neighborhood,
        phone,
        manager_name: managerName,
        status,
      })
      .eq('id', id);

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível editar a unidade.';
  }

  if (errorMessage) redirect(target(UNITS_PATH, errorMessage));
  revalidateOperationalData(UNITS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(UNITS_PATH, 'Unidade atualizada com sucesso.'));
}

export async function deleteHealthUnitAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageUnits();
    const id = String(formData.get('id') || '');
    const confirmDelete = String(formData.get('confirm_delete') || '') === '1';

    ensureUuid(id, 'Unidade não identificada.');
    if (!confirmDelete) throw new Error('Confirme a exclusão definitiva da unidade antes de continuar.');

    const admin = await getValidatedAdminClient();
    const [
      { data: evaluations, error: evaluationsError },
      { data: professionals, error: professionalsError },
    ] = await Promise.all([
      admin.from('evaluations').select('id').eq('health_unit_id', id),
      admin.from('professionals').select('id').eq('health_unit_id', id),
    ]);

    const firstDeleteError = evaluationsError || professionalsError;
    if (firstDeleteError) {
      errorMessage = firstDeleteError.message;
    } else {
      const evaluationIds = (evaluations || []).map((evaluation) => evaluation.id as string);
      const professionalIds = (professionals || []).map((professional) => professional.id as string);

      if (evaluationIds.length) {
        const { error } = await admin.from('evaluation_professionals').delete().in('evaluation_id', evaluationIds);
        if (error) errorMessage = error.message;
      }

      if (!errorMessage && professionalIds.length) {
        const { error } = await admin.from('evaluation_professionals').delete().in('professional_id', professionalIds);
        if (error) errorMessage = error.message;
      }

      if (!errorMessage && evaluationIds.length) {
        const { error } = await admin.from('evaluations').delete().in('id', evaluationIds);
        if (error) errorMessage = error.message;
      }

      if (!errorMessage && professionalIds.length) {
        const { error } = await admin.from('professionals').delete().in('id', professionalIds);
        if (error) errorMessage = error.message;
      }

      if (!errorMessage) {
        const { error } = await admin.from('health_units').delete().eq('id', id);
        if (error) errorMessage = error.message;
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível excluir a unidade.';
  }

  if (errorMessage) redirect(target(UNITS_PATH, errorMessage));
  revalidateOperationalData(UNITS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(UNITS_PATH, 'Unidade, profissionais e avaliações vinculadas foram excluídos.'));
}

export async function createProfessionalAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentProfile = await assertCanManageProfessionals();
    const fullName = cleanText(formData.get('full_name'), 120);
    const position = cleanText(formData.get('position'), 100);
    const professionalLicense = optionalText(formData.get('professional_license'), 80);
    const healthUnitId = cleanText(formData.get('health_unit_id'), 40);
    const workSchedule = optionalText(formData.get('work_schedule'), 500);

    validateFullName(fullName, 'o nome completo do profissional');
    if (position.length < 2 || position.length > 100) throw new Error('Informe o cargo ou função com 2 a 100 caracteres.');
    ensureUuid(healthUnitId, 'Selecione uma unidade válida.');
    await ensureHealthUnitExists(healthUnitId);

    const supabase = await createClient();
    const { error } = await supabase.from('professionals').insert({
      full_name: fullName,
      position,
      professional_license: professionalLicense,
      health_unit_id: healthUnitId,
      work_schedule: workSchedule,
      status: 'active',
      created_by: currentProfile.id,
    });

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível cadastrar o profissional.';
  }

  if (errorMessage) redirect(target(PROFESSIONALS_PATH, errorMessage));
  revalidateOperationalData(PROFESSIONALS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PROFESSIONALS_PATH, 'Profissional cadastrado com sucesso.'));
}

export async function toggleProfessionalStatusAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageProfessionals();
    const supabase = await createClient();
    const id = String(formData.get('id') || '');
    const status = String(formData.get('status') || '') === 'active' ? 'inactive' : 'active';

    ensureUuid(id, 'Profissional não identificado.');

    const { error } = await supabase.from('professionals').update({ status }).eq('id', id);
    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar o profissional.';
  }

  if (errorMessage) redirect(target(PROFESSIONALS_PATH, errorMessage));
  revalidateOperationalData(PROFESSIONALS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PROFESSIONALS_PATH, 'Status do profissional atualizado com sucesso.'));
}

export async function updateProfessionalAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageProfessionals();
    const id = cleanText(formData.get('id'), 40);
    const fullName = cleanText(formData.get('full_name'), 120);
    const position = cleanText(formData.get('position'), 100);
    const professionalLicense = optionalText(formData.get('professional_license'), 80);
    const healthUnitId = cleanText(formData.get('health_unit_id'), 40);
    const workSchedule = optionalText(formData.get('work_schedule'), 500);
    const status = cleanText(formData.get('status'), 20);

    ensureUuid(id, 'Profissional não identificado.');
    validateFullName(fullName, 'o nome completo do profissional');
    if (position.length < 2 || position.length > 100) throw new Error('Informe o cargo ou função com 2 a 100 caracteres.');
    ensureUuid(healthUnitId, 'Selecione uma unidade válida.');
    validateStatus(status, 'Status do profissional');
    await ensureHealthUnitExists(healthUnitId);

    const admin = await getValidatedAdminClient();
    const { error } = await admin
      .from('professionals')
      .update({
        full_name: fullName,
        position,
        professional_license: professionalLicense,
        health_unit_id: healthUnitId,
        work_schedule: workSchedule,
        status,
      })
      .eq('id', id);

    if (error) errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível editar o profissional.';
  }

  if (errorMessage) redirect(target(PROFESSIONALS_PATH, errorMessage));
  revalidateOperationalData(PROFESSIONALS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PROFESSIONALS_PATH, 'Profissional atualizado com sucesso.'));
}

export async function deleteProfessionalAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertCanManageProfessionals();
    const id = String(formData.get('id') || '');
    const confirmDelete = String(formData.get('confirm_delete') || '') === '1';

    ensureUuid(id, 'Profissional não identificado.');
    if (!confirmDelete) throw new Error('Confirme a exclusão definitiva do profissional antes de continuar.');
    await ensureProfessionalExists(id);

    const admin = await getValidatedAdminClient();
    const { error: linkedError } = await admin.from('evaluation_professionals').delete().eq('professional_id', id);
    if (linkedError) {
      errorMessage = linkedError.message;
    } else {
      const { error } = await admin.from('professionals').delete().eq('id', id);
      if (error) errorMessage = error.message;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível excluir o profissional.';
  }

  if (errorMessage) redirect(target(PROFESSIONALS_PATH, errorMessage));
  revalidateOperationalData(PROFESSIONALS_PATH, '/avalie', '/painel', '/ranking');
  redirect(successTarget(PROFESSIONALS_PATH, 'Profissional excluído com sucesso.'));
}

export async function unlockUserManagementAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await assertCanManageUsers();
    const cooldownSeconds = await getUserManagementUnlockCooldown();
    if (cooldownSeconds > 0) {
      throw new Error(`Muitas tentativas na senha adicional. Aguarde ${cooldownSeconds} segundos e tente novamente.`);
    }

    errorMessage = validateAdminCreationPasswordValue(
      formData.get('admin_creation_password'),
      'visualizar a gestão de usuários',
    );

    if (errorMessage) {
      await registerUserManagementGateFailure();
    } else {
      await clearUserManagementGateFailures();
      await unlockUserManagementGate(currentAdmin.id);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível liberar a gestão de usuários.';
  }

  if (errorMessage) redirect(target(USERS_PATH, errorMessage));
  redirect(successTarget(USERS_PATH, 'Gestão de usuários liberada temporariamente.'));
}

export async function createSystemUserAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await validateUserManagementGate();
    const fullName = cleanText(formData.get('full_name'), 120);
    const email = cleanText(formData.get('email'), 254).toLowerCase();
    const password = String(formData.get('password') || '').trim();
    const role = cleanText(formData.get('role'), 20);

    validateFullName(fullName, 'o nome completo do usuário');
    if (!isValidEmail(email)) throw new Error('Informe um e-mail válido.');
    if (password.length < 8 || password.length > 128) throw new Error('Informe uma senha forte com 8 a 128 caracteres.');
    if (!isValidEnum(role, APP_ROLES)) throw new Error('Perfil de usuário inválido.');

    const admin = await getValidatedAdminClient();
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authUser.user) {
      errorMessage = authError?.message || 'Não foi possível criar o usuário.';
    } else {
      const { error: profileError } = await admin.from('profiles').upsert({
        id: authUser.user.id,
        full_name: fullName,
        email,
        role,
        status: 'active',
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(authUser.user.id);
        errorMessage = profileError.message;
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível criar o usuário.';
  }

  if (errorMessage) redirect(target(USERS_PATH, errorMessage));
  revalidatePath(USERS_PATH);
  redirect(successTarget(USERS_PATH, 'Usuário criado com sucesso.'));
}

export async function updateSystemUserAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await validateUserManagementGate();
    const id = cleanText(formData.get('id'), 40);
    const fullName = cleanText(formData.get('full_name'), 120);
    const email = cleanText(formData.get('email'), 254).toLowerCase();
    const password = String(formData.get('password') || '').trim();
    const role = cleanText(formData.get('role'), 20);
    const status = cleanText(formData.get('status'), 20);

    ensureUuid(id, 'Usuário não identificado.');
    validateFullName(fullName, 'o nome completo do usuário');
    if (!isValidEmail(email)) throw new Error('Informe um e-mail válido.');
    if (password && (password.length < 8 || password.length > 128)) throw new Error('A nova senha deve ter 8 a 128 caracteres.');
    if (!isValidEnum(role, APP_ROLES) || !isValidEnum(status, RECORD_STATUSES)) {
      throw new Error('Perfil ou status inválido.');
    }
    if (id === currentAdmin.id && (role !== 'admin' || status !== 'active')) {
      throw new Error('Por segurança, o administrador logado não pode remover o próprio acesso.');
    }

    const admin = await getValidatedAdminClient();
    const authPayload: {
      email: string;
      password?: string;
      user_metadata: { full_name: string };
    } = {
      email,
      user_metadata: { full_name: fullName },
    };

    if (password) authPayload.password = password;

    const { error: authError } = await admin.auth.admin.updateUserById(id, authPayload);
    if (authError) {
      errorMessage = authError.message;
    } else {
      const { error } = await admin
        .from('profiles')
        .update({ full_name: fullName, email, role, status })
        .eq('id', id);
      if (error) errorMessage = error.message;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.';
  }

  if (errorMessage) redirect(target(USERS_PATH, errorMessage));
  revalidatePath(USERS_PATH);
  redirect(successTarget(USERS_PATH, 'Usuário atualizado com sucesso.'));
}

export async function deleteSystemUserAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const currentAdmin = await validateUserManagementGate();
    const id = cleanText(formData.get('id'), 40);
    const confirmDelete = String(formData.get('confirm_delete') || '') === '1';

    ensureUuid(id, 'Usuário não identificado.');
    if (id === currentAdmin.id) {
      throw new Error('Por segurança, o administrador logado não pode excluir o próprio usuário.');
    }
    if (!confirmDelete) {
      throw new Error('Confirme a exclusão do usuário antes de continuar.');
    }

    const admin = await getValidatedAdminClient();
    const { error: authError } = await admin.auth.admin.deleteUser(id);

    if (authError && !authError.message.toLowerCase().includes('not found')) {
      errorMessage = authError.message;
    } else {
      const { error: profileError } = await admin.from('profiles').delete().eq('id', id);
      if (profileError) errorMessage = profileError.message;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível excluir o usuário.';
  }

  if (errorMessage) redirect(target(USERS_PATH, errorMessage));
  revalidatePath(USERS_PATH);
  redirect(successTarget(USERS_PATH, 'Usuário excluído com sucesso.'));
}
