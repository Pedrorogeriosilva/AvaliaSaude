'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim() || null;
}

export async function createPatientAction(formData: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId();

  await supabase.from('patients').insert({
    full_name: clean(formData.get('full_name')),
    cpf: clean(formData.get('cpf'))?.replace(/\D/g, '') || null,
    birth_date: clean(formData.get('birth_date')),
    phone: clean(formData.get('phone')),
    whatsapp: clean(formData.get('whatsapp')),
    address: clean(formData.get('address')),
    neighborhood: clean(formData.get('neighborhood')),
    status: 'active',
    created_by: userId,
  });

  revalidatePath('/cadastros/pacientes');
}

export async function togglePatientStatusAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) === 'active' ? 'inactive' : 'active';

  await supabase.from('patients').update({ status }).eq('id', id);
  revalidatePath('/cadastros/pacientes');
}

export async function createHealthUnitAction(formData: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId();

  await supabase.from('health_units').insert({
    name: clean(formData.get('name')),
    type: String(formData.get('type') || 'psf'),
    address: clean(formData.get('address')),
    neighborhood: clean(formData.get('neighborhood')),
    phone: clean(formData.get('phone')),
    manager_name: clean(formData.get('manager_name')),
    status: 'active',
    created_by: userId,
  });

  revalidatePath('/cadastros/unidades');
}

export async function toggleHealthUnitStatusAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) === 'active' ? 'inactive' : 'active';

  await supabase.from('health_units').update({ status }).eq('id', id);
  revalidatePath('/cadastros/unidades');
}

export async function createProfessionalAction(formData: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId();

  await supabase.from('professionals').insert({
    full_name: clean(formData.get('full_name')),
    position: clean(formData.get('position')),
    professional_license: clean(formData.get('professional_license')),
    health_unit_id: String(formData.get('health_unit_id') || ''),
    work_schedule: clean(formData.get('work_schedule')),
    status: 'active',
    created_by: userId,
  });

  revalidatePath('/cadastros/profissionais');
}

export async function toggleProfessionalStatusAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) === 'active' ? 'inactive' : 'active';

  await supabase.from('professionals').update({ status }).eq('id', id);
  revalidatePath('/cadastros/profissionais');
}
