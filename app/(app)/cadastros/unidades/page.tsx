import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { createClient } from '@/lib/supabase/server';
import { labelUnitType } from '@/lib/format';
import { createHealthUnitAction, toggleHealthUnitStatusAction } from '../actions';

type Props = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function UnidadesPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const supabase = await createClient();

  let request = supabase.from('health_units').select('*').order('name').limit(50);
  if (query) request = request.ilike('name', `%${query}%`);
  const { data: units } = await request;

  return (
    <>
      <PageHeader title="Unidades de saúde" description="Cadastro de PSFs, hospital e demais unidades utilizadas nas avaliações." />

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <SectionCard title="Nova unidade">
          <form action={createHealthUnitAction} className="space-y-3">
            <Input label="Nome da unidade" name="name" required />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
              <select name="type" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="psf">PSF</option>
                <option value="hospital">Hospital</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <Input label="Endereço" name="address" required />
            <Input label="Bairro" name="neighborhood" />
            <Input label="Telefone" name="phone" />
            <Input label="Responsável" name="manager_name" />
            <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar unidade</button>
          </form>
        </SectionCard>

        <SectionCard title="Unidades cadastradas">
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={query} placeholder="Buscar unidade" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">Buscar</button>
          </form>
          <div className="table-responsive">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Endereço</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(units || []).map((unit: any) => (
                  <tr key={unit.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{unit.name}</td>
                    <td className="px-3 py-3">{labelUnitType(unit.type)}</td>
                    <td className="px-3 py-3">{unit.address}</td>
                    <td className="px-3 py-3"><StatusBadge status={unit.status} /></td>
                    <td className="px-3 py-3">
                      <form action={toggleHealthUnitStatusAction}>
                        <input type="hidden" name="id" value={unit.id} />
                        <input type="hidden" name="status" value={unit.status} />
                        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
                          {unit.status === 'active' ? 'Inativar' : 'Ativar'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!units?.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Nenhuma unidade encontrada.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Input({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input name={name} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );
}
