import { DisclosureCard } from '@/components/ui/disclosure-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getCurrentProfile } from '@/lib/auth';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { getFriendlyErrorMessage, getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import { buildSearchPattern } from '@/lib/validation';
import { createProfessionalAction, deleteProfessionalAction, updateProfessionalAction } from '../actions';

type Props = { searchParams?: Promise<{ q?: string; page?: string; error?: string; success?: string }> };

type UnitOption = {
  id: string;
  name: string;
};

type ProfessionalRawRow = {
  id: string;
  full_name: string;
  position: string | null;
  professional_license: string | null;
  health_unit_id: string | null;
  work_schedule: string | null;
  status: string | null;
  health_units: { name: string | null } | { name: string | null }[] | null;
};

type ProfessionalRow = Omit<ProfessionalRawRow, 'health_units'> & {
  health_unit_name: string | null;
};

function normalizeProfessional(row: ProfessionalRawRow): ProfessionalRow {
  const relation = Array.isArray(row.health_units) ? row.health_units[0] : row.health_units;
  return {
    id: row.id,
    full_name: row.full_name,
    position: row.position,
    professional_license: row.professional_license,
    health_unit_id: row.health_unit_id,
    work_schedule: row.work_schedule,
    status: row.status,
    health_unit_name: relation?.name || null,
  };
}

export default async function ProfissionaisPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const searchPattern = buildSearchPattern(query);
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    let professionalsRequest = supabase
      .from('professionals')
      .select('id, full_name, position, professional_license, health_unit_id, work_schedule, status, health_units(name)')
      .order('full_name')
      .range(from, to);

    if (searchPattern) professionalsRequest = professionalsRequest.ilike('full_name', searchPattern);

    const [currentProfile, { data: units, error: unitsError }, { data: professionals, error: professionalsError }] = await Promise.all([
      getCurrentProfile(),
      supabase.from('health_units').select('id, name').order('name'),
      professionalsRequest,
    ]);
    const isAdmin = Boolean(currentProfile?.is_master) || currentProfile?.role === 'admin';

    const error = unitsError || professionalsError;

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar a listagem de profissionais.')} />;
    }

    const unitRows = (units || []) as UnitOption[];
    const professionalRows = ((professionals || []) as ProfessionalRawRow[]).map(normalizeProfessional);
    const hasNextPage = professionalRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Profissionais" />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <SectionCard title={isAdmin ? 'Novo profissional' : 'Cadastro protegido'}>
            {isAdmin ? (
              <form action={createProfessionalAction} className="space-y-3">
                <Input label="Nome completo" name="full_name" required />
                <Input label="Cargo/Função" name="position" required />
                <Input label="Conselho/Registro" name="professional_license" />
                <UnitSelect units={unitRows} />
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">Horário de trabalho</span>
                  <textarea name="work_schedule" rows={3} placeholder="Ex.: Segunda a sexta, 07h às 13h" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
                </label>
                <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar profissional</button>
              </form>
            ) : (
              <EmptyState title="Somente leitura." />
            )}
          </SectionCard>

          <SectionCard title="Profissionais cadastrados">
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={query} placeholder="Buscar profissional" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
              <button className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            <div className="space-y-4">
              {professionalRows.map((professional) => (
                <DisclosureCard
                  key={professional.id}
                  title={professional.full_name}
                  description={[professional.position || '', professional.health_unit_name || '', professional.work_schedule || ''].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}
                  meta={
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={professional.status} />
                      {professional.professional_license ? <span>{professional.professional_license}</span> : null}
                    </div>
                  }
                >
                  {isAdmin ? (
                    <>
                      <form action={updateProfessionalAction} className="space-y-3">
                        <input type="hidden" name="id" value={professional.id} />
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <InlineInput label="Nome" name="full_name" defaultValue={professional.full_name} required />
                          <InlineInput label="Cargo/Função" name="position" defaultValue={professional.position || ''} required />
                          <InlineInput label="Conselho/Registro" name="professional_license" defaultValue={professional.professional_license || ''} />
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                            <select name="status" defaultValue={professional.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                              <option value="active">Ativo</option>
                              <option value="inactive">Inativo</option>
                            </select>
                          </label>
                          <label className="block md:col-span-2">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Unidade vinculada</span>
                            <select name="health_unit_id" defaultValue={professional.health_unit_id || ''} required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                              <option value="">Selecione</option>
                              {unitRows.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                          </label>
                          <label className="block md:col-span-2">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Horário de trabalho</span>
                            <textarea name="work_schedule" rows={2} defaultValue={professional.work_schedule || ''} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                          </label>
                        </div>
                        <div className="flex justify-end border-t border-slate-100 pt-3">
                          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salvar alterações</button>
                        </div>
                      </form>

                      <form action={deleteProfessionalAction} className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 md:grid-cols-[1fr_130px] md:items-center">
                        <input type="hidden" name="id" value={professional.id} />
                        <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                          <input type="checkbox" name="confirm_delete" value="1" required />
                          Excluir definitivamente este profissional e as notas individuais vinculadas.
                        </label>
                        <button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                      </form>
                    </>
                  ) : (
                    <div className="grid gap-2 text-sm md:grid-cols-5">
                      <strong className="text-slate-900">{professional.full_name}</strong>
                      <span>{professional.position || '-'}</span>
                      <span>{professional.health_unit_name || '-'}</span>
                      <span>{professional.work_schedule || '-'}</span>
                      <StatusBadge status={professional.status} />
                    </div>
                  )}
                </DisclosureCard>
              ))}
              {!professionalRows.length ? <EmptyState title="Nenhum registro encontrado." /> : null}
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/profissionais" query={query} />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Não foi possível carregar os dados." />;
  }
}

function UnitSelect({ units }: { units: UnitOption[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">Unidade vinculada</span>
      <select name="health_unit_id" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600">
        <option value="">Selecione</option>
        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
    </label>
  );
}

function Input({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input name={name} required={required} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
    </label>
  );
}

function InlineInput({ label, name, required = false, defaultValue = '' }: { label: string; name: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <input name={name} required={required} defaultValue={defaultValue} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
    </label>
  );
}
