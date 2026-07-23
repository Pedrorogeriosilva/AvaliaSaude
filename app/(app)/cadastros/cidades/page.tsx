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
import { BRAZIL_UFS } from '@/lib/validation';
import { createCityAction, updateCityAction } from '../actions';

type Props = { searchParams?: Promise<{ page?: string; error?: string; success?: string }> };

type CityRow = {
  id: string;
  name: string;
  state_uf: string;
  status: string | null;
  units: { count: number }[] | null;
};

export default async function CidadesPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const page = getPage(params.page);
  const { from, to } = getRange(page);
  const currentProfile = await getCurrentProfile();

  if (!currentProfile?.is_master) {
    return (
      <>
        <PageHeader title="Cidades" />
        <EmptyState title="Acesso restrito." description="Somente o usuário master administra as cidades." />
      </>
    );
  }

  const supabase = await createClient();
  const { data: cities, error } = await supabase
    .from('cities')
    .select('id, name, state_uf, status, units:health_units(count)')
    .order('name')
    .range(from, to);

  if (error) {
    return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar as cidades.')} />;
  }

  const cityRows = (cities || []) as CityRow[];
  const hasNextPage = cityRows.length === DEFAULT_PAGE_SIZE;

  return (
    <>
      <PageHeader title="Cidades" />
      {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
      {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <SectionCard title="Nova cidade">
          <form action={createCityAction} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nome da cidade</span>
              <input name="name" required maxLength={120} placeholder="Ex.: Porto Alegre do Norte" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Estado (UF)</span>
              <select name="state_uf" required defaultValue="" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600">
                <option value="" disabled>Selecione</option>
                {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
            <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar cidade</button>
          </form>
        </SectionCard>

        <SectionCard title="Cidades cadastradas">
          <div className="space-y-4">
            {cityRows.map((city) => {
              const unitCount = city.units?.[0]?.count ?? 0;
              return (
                <DisclosureCard
                  key={city.id}
                  title={`${city.name} / ${city.state_uf}`}
                  meta={
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={city.status} />
                      <span>{unitCount} {unitCount === 1 ? 'unidade' : 'unidades'}</span>
                    </div>
                  }
                >
                  <form action={updateCityAction} className="space-y-3">
                    <input type="hidden" name="id" value={city.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="block md:col-span-1">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Nome</span>
                        <input name="name" defaultValue={city.name} required maxLength={120} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">UF</span>
                        <select name="state_uf" defaultValue={city.state_uf} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                          {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                        <select name="status" defaultValue={city.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600">
                          <option value="active">Ativa</option>
                          <option value="inactive">Inativa</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-end border-t border-slate-100 pt-3">
                      <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salvar alterações</button>
                    </div>
                  </form>
                </DisclosureCard>
              );
            })}
            {!cityRows.length ? <EmptyState title="Nenhuma cidade cadastrada." description="Cadastre a primeira cidade para começar a separar unidades e gestores." /> : null}
          </div>
          <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/cidades" />
        </SectionCard>
      </div>
    </>
  );
}
