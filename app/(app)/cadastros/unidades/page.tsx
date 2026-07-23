import { DisclosureCard } from '@/components/ui/disclosure-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getCurrentProfile } from '@/lib/auth';
import { labelUnitType } from '@/lib/format';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { getFriendlyErrorMessage, getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import { CitySelect } from '@/components/ui/city-select';
import { getActiveCities } from '@/lib/app-data';
import { buildSearchPattern } from '@/lib/validation';
import { createHealthUnitAction, deleteHealthUnitAction, updateHealthUnitAction } from '../actions';

type Props = { searchParams?: Promise<{ q?: string; page?: string; error?: string; success?: string }> };

type UnitRow = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  neighborhood: string | null;
  phone: string | null;
  manager_name: string | null;
  status: string | null;
};

export default async function UnidadesPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const searchPattern = buildSearchPattern(query);
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    let request = supabase.from('health_units').select('id, name, type, address, neighborhood, phone, manager_name, status').order('name').range(from, to);
    if (searchPattern) request = request.ilike('name', searchPattern);
    const [{ data: units, error }, currentProfile] = await Promise.all([request, getCurrentProfile()]);
    const isMaster = Boolean(currentProfile?.is_master);
    const canManage = isMaster || currentProfile?.role === 'admin';
    const cities = isMaster ? await getActiveCities() : [];

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar a listagem de unidades.')} />;
    }

    const unitRows = (units || []) as UnitRow[];
    const hasNextPage = unitRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Unidades de saúde" />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <SectionCard title={canManage ? 'Nova unidade' : 'Cadastro protegido'}>
            {canManage ? (
              <form action={createHealthUnitAction} className="space-y-3">
                {isMaster ? <CitySelect cities={cities} /> : null}
                <Input label="Nome da unidade" name="name" required />
                <UnitTypeSelect />
                <Input label="Endereço" name="address" required />
                <Input label="Bairro" name="neighborhood" />
                <Input label="Telefone" name="phone" />
                <Input label="Responsável" name="manager_name" />
                <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar unidade</button>
              </form>
            ) : (
              <EmptyState title="Somente leitura." />
            )}
          </SectionCard>

          <SectionCard title="Unidades cadastradas">
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={query} placeholder="Buscar unidade" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
              <button className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            <div className="space-y-4">
              {unitRows.map((unit) => (
                <DisclosureCard
                  key={unit.id}
                  title={unit.name}
                  description={[labelUnitType(unit.type), unit.address || '', unit.neighborhood || ''].filter(Boolean).join(' · ') || 'Sem endereço informado'}
                  meta={
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={unit.status} />
                      {unit.manager_name ? <span>Responsável: {unit.manager_name}</span> : null}
                    </div>
                  }
                >
                  {canManage ? (
                    <>
                      <form action={updateHealthUnitAction} className="space-y-3">
                        <input type="hidden" name="id" value={unit.id} />
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <InlineInput label="Unidade" name="name" defaultValue={unit.name} required />
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Tipo</span>
                            <select name="type" defaultValue={unit.type || 'psf'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                              <option value="psf">PSF</option>
                              <option value="hospital">Hospital</option>
                              <option value="other">Outro</option>
                            </select>
                          </label>
                          <InlineInput label="Endereço" name="address" defaultValue={unit.address || ''} required />
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                            <select name="status" defaultValue={unit.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                              <option value="active">Ativo</option>
                              <option value="inactive">Inativo</option>
                            </select>
                          </label>
                          <InlineInput label="Bairro" name="neighborhood" defaultValue={unit.neighborhood || ''} />
                          <InlineInput label="Telefone" name="phone" defaultValue={unit.phone || ''} />
                          <InlineInput label="Responsável" name="manager_name" defaultValue={unit.manager_name || ''} />
                        </div>
                        <div className="flex justify-end border-t border-slate-100 pt-3">
                          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salvar alterações</button>
                        </div>
                      </form>

                      <form action={deleteHealthUnitAction} className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 md:grid-cols-[1fr_130px] md:items-center">
                        <input type="hidden" name="id" value={unit.id} />
                        <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                          <input type="checkbox" name="confirm_delete" value="1" required />
                          Excluir definitivamente esta unidade, seus profissionais e avaliações vinculadas.
                        </label>
                        <button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                      </form>
                    </>
                  ) : (
                    <div className="grid gap-2 text-sm md:grid-cols-4">
                      <strong className="text-slate-900">{unit.name}</strong>
                      <span>{labelUnitType(unit.type)}</span>
                      <span>{unit.address || '-'}</span>
                      <StatusBadge status={unit.status} />
                    </div>
                  )}
                </DisclosureCard>
              ))}
              {!unitRows.length ? <EmptyState title="Nenhum registro encontrado." /> : null}
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/unidades" query={query} />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Não foi possível carregar os dados." />;
  }
}

function UnitTypeSelect() {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
      <select name="type" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600">
        <option value="psf">PSF</option>
        <option value="hospital">Hospital</option>
        <option value="other">Outro</option>
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
