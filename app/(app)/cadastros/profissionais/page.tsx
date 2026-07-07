import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { createClient } from '@/lib/supabase/server';
import { createProfessionalAction, toggleProfessionalStatusAction } from '../actions';

type Props = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ProfissionaisPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const supabase = await createClient();

  const { data: units } = await supabase.from('health_units').select('id, name').eq('status', 'active').order('name');
  let request = supabase
    .from('professionals')
    .select('*, health_units(name)')
    .order('full_name')
    .limit(50);
  if (query) request = request.ilike('full_name', `%${query}%`);
  const { data: professionals } = await request;

  return (
    <>
      <PageHeader title="Profissionais" description="Cadastro de profissionais vinculados às unidades de saúde." />

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <SectionCard title="Novo profissional">
          <form action={createProfessionalAction} className="space-y-3">
            <Input label="Nome completo" name="full_name" required />
            <Input label="Cargo/Função" name="position" required />
            <Input label="Conselho/Registro" name="professional_license" />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Unidade vinculada</span>
              <select name="health_unit_id" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Selecione</option>
                {(units || []).map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Horário de trabalho</span>
              <textarea name="work_schedule" rows={3} placeholder="Ex.: Segunda a sexta, 07h às 13h" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar profissional</button>
          </form>
        </SectionCard>

        <SectionCard title="Profissionais cadastrados">
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={query} placeholder="Buscar profissional" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">Buscar</button>
          </form>
          <div className="table-responsive">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">Cargo</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3">Horário</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(professionals || []).map((professional: any) => (
                  <tr key={professional.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{professional.full_name}</td>
                    <td className="px-3 py-3">{professional.position}</td>
                    <td className="px-3 py-3">{professional.health_units?.name || '-'}</td>
                    <td className="px-3 py-3">{professional.work_schedule || '-'}</td>
                    <td className="px-3 py-3"><StatusBadge status={professional.status} /></td>
                    <td className="px-3 py-3">
                      <form action={toggleProfessionalStatusAction}>
                        <input type="hidden" name="id" value={professional.id} />
                        <input type="hidden" name="status" value={professional.status} />
                        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
                          {professional.status === 'active' ? 'Inativar' : 'Ativar'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!professionals?.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nenhum profissional encontrado.</td></tr> : null}
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
