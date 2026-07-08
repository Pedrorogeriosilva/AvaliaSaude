import { getCurrentProfile } from '@/lib/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { labelUnitType } from '@/lib/format';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import { createHealthUnitAction, deleteHealthUnitAction, updateHealthUnitAction } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    const currentProfile = await getCurrentProfile();
    const isAdmin = currentProfile?.role === 'admin';
    let request = supabase.from('health_units').select('id, name, type, address, neighborhood, phone, manager_name, status').order('name').range(from, to);
    if (query) request = request.ilike('name', `%${query}%`);
    const { data: units, error } = await request;

    if (error) {
      return <EmptyState title="Unidades indisponíveis" description={getFriendlySupabaseError(error, 'Não foi possível carregar a listagem de unidades.')} />;
    }

    const unitRows = (units || []) as UnitRow[];
    const hasNextPage = unitRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Unidades de saúde" description="Cadastro de PSFs, hospital e demais unidades utilizadas nas avaliações." />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{params.error}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <SectionCard title="Nova unidade">
            <form action={createHealthUnitAction} className="space-y-3">
              <Input label="Nome da unidade" name="name" required />
              <UnitTypeSelect />
              <Input label="Endereço" name="address" required />
              <Input label="Bairro" name="neighborhood" />
              <Input label="Telefone" name="phone" />
              <Input label="Responsável" name="manager_name" />
              <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar unidade</button>
            </form>
          </SectionCard>

          <SectionCard title="Unidades cadastradas" description="Edite os dados da unidade ou exclua definitivamente. A exclusão remove também profissionais e avaliações vinculadas à unidade.">
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={query} placeholder="Buscar unidade" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
              <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            <div className="space-y-4">
              {unitRows.map((unit) => (
                <div key={unit.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  {isAdmin ? (
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
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <StatusBadge status={unit.status} />
                          <span>{labelUnitType(unit.type)}</span>
                        </div>
                        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salvar alterações</button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-2 text-sm md:grid-cols-4">
                      <strong className="text-slate-900">{unit.name}</strong>
                      <span>{labelUnitType(unit.type)}</span>
                      <span>{unit.address || '-'}</span>
                      <StatusBadge status={unit.status} />
                    </div>
                  )}

                  {isAdmin ? (
                    <form action={deleteHealthUnitAction} className="mt-3 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 md:grid-cols-[1fr_130px] md:items-center">
                      <input type="hidden" name="id" value={unit.id} />
                      <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                        <input type="checkbox" name="confirm_delete" value="1" required />
                        Excluir definitivamente esta unidade, seus profissionais e avaliações vinculadas.
                      </label>
                      <button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                    </form>
                  ) : null}
                </div>
              ))}
              {!unitRows.length ? <EmptyState title="Nenhuma unidade encontrada" description="Cadastre unidades ou ajuste a busca para visualizar resultados." /> : null}
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/unidades" query={query} />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Unidades indisponíveis" description="Não foi possível carregar a listagem de unidades. Confira a configuração do Supabase." />;
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
