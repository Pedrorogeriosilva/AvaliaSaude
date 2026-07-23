import { DisclosureCard } from '@/components/ui/disclosure-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getCurrentProfile } from '@/lib/auth';
import { formatDate, maskCpf } from '@/lib/format';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { getFriendlyErrorMessage, getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import { CitySelect } from '@/components/ui/city-select';
import { getActiveCities } from '@/lib/app-data';
import { buildSearchPattern } from '@/lib/validation';
import { createPatientAction, deletePatientAction, updatePatientAction } from '../actions';

type Props = { searchParams?: Promise<{ q?: string; page?: string; error?: string; success?: string }> };

type PatientRow = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  neighborhood: string | null;
  created_at: string | null;
  status: string | null;
};

export default async function PacientesPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const searchPattern = buildSearchPattern(query);
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    let request = supabase
      .from('patients')
      .select('id, full_name, cpf, phone, whatsapp, address, neighborhood, created_at, status')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (searchPattern) request = request.ilike('full_name', searchPattern);

    const [{ data: patients, error }, currentProfile] = await Promise.all([request, getCurrentProfile()]);
    const isMaster = Boolean(currentProfile?.is_master);
    const canEdit = isMaster || currentProfile?.role === 'admin' || currentProfile?.role === 'operator';
    const canDelete = isMaster || currentProfile?.role === 'admin';
    const cities = isMaster ? await getActiveCities() : [];

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar a listagem de pacientes.')} />;
    }

    const patientRows = (patients || []) as PatientRow[];
    const hasNextPage = patientRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Pacientes" />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <SectionCard title={canEdit ? 'Novo paciente' : 'Cadastro protegido'}>
            {canEdit ? (
              <form action={createPatientAction} className="space-y-3">
                {isMaster ? <CitySelect cities={cities} /> : null}
                <Input label="Nome completo" name="full_name" required />
                <Input label="CPF" name="cpf" placeholder="Somente números" />
                <Input label="Telefone" name="phone" />
                <Input label="WhatsApp" name="whatsapp" />
                <Input label="Endereço" name="address" />
                <Input label="Bairro" name="neighborhood" />
                <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar paciente</button>
              </form>
            ) : (
              <EmptyState title="Somente leitura." />
            )}
          </SectionCard>

          <SectionCard title="Pacientes cadastrados">
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={query} placeholder="Buscar paciente" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
              <button className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            <div className="space-y-4">
              {patientRows.map((patient) => (
                <DisclosureCard
                  key={patient.id}
                  title={patient.full_name}
                  description={[patient.cpf ? `CPF ${maskCpf(patient.cpf)}` : '', patient.phone || patient.whatsapp || '', patient.neighborhood || ''].filter(Boolean).join(' · ') || 'Sem informações complementares'}
                  meta={
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={patient.status} />
                      <span>Cadastrado em {formatDate(patient.created_at?.slice(0, 10))}</span>
                    </div>
                  }
                >
                  {canEdit ? (
                    <form action={updatePatientAction} className="space-y-3">
                      <input type="hidden" name="id" value={patient.id} />
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InlineInput label="Nome" name="full_name" defaultValue={patient.full_name} required />
                        <InlineInput label="CPF" name="cpf" defaultValue={patient.cpf || ''} placeholder="Somente números" />
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                          <select name="status" defaultValue={patient.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                          </select>
                        </label>
                        <InlineInput label="Telefone" name="phone" defaultValue={patient.phone || ''} />
                        <InlineInput label="WhatsApp" name="whatsapp" defaultValue={patient.whatsapp || ''} />
                        <InlineInput label="Endereço" name="address" defaultValue={patient.address || ''} />
                        <InlineInput label="Bairro" name="neighborhood" defaultValue={patient.neighborhood || ''} />
                      </div>
                      <div className="flex justify-end border-t border-slate-100 pt-3">
                        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salvar alterações</button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-2 text-sm md:grid-cols-4">
                      <strong className="text-slate-900">{patient.full_name}</strong>
                      <span>{patient.phone || patient.whatsapp || '-'}</span>
                      <span>{patient.neighborhood || '-'}</span>
                      <StatusBadge status={patient.status} />
                    </div>
                  )}

                  {canDelete ? (
                    <form action={deletePatientAction} className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 md:grid-cols-[1fr_130px] md:items-center">
                      <input type="hidden" name="id" value={patient.id} />
                      <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                        <input type="checkbox" name="confirm_delete" value="1" required />
                        Excluir definitivamente este paciente e as avaliações vinculadas.
                      </label>
                      <button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                    </form>
                  ) : null}
                </DisclosureCard>
              ))}
              {!patientRows.length ? <EmptyState title="Nenhum registro encontrado." /> : null}
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/pacientes" query={query} />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Não foi possível carregar os dados." />;
  }
}

function Input({ label, name, type = 'text', required = false, placeholder = '' }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
    </label>
  );
}

function InlineInput({ label, name, type = 'text', required = false, defaultValue = '', placeholder = '' }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
    </label>
  );
}
