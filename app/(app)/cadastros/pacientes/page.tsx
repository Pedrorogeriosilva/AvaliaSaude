import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { createPatientAction, togglePatientStatusAction } from '../actions';

type Props = { searchParams?: Promise<{ q?: string; page?: string; error?: string }> };

export default async function PacientesPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() || '';
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    let request = supabase.from('patients').select('id, full_name, phone, whatsapp, neighborhood, created_at, status').order('created_at', { ascending: false }).range(from, to);
    if (query) request = request.ilike('full_name', `%${query}%`);
    const { data: patients } = await request;
    const patientRows = patients || [];
    const hasNextPage = patientRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Pacientes" description="Cadastro de pacientes vinculados às avaliações de atendimento." />
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{params.error}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <SectionCard title="Novo paciente">
            <form action={createPatientAction} className="space-y-3">
              <Input label="Nome completo" name="full_name" required />
              <Input label="CPF" name="cpf" placeholder="Somente números" />
              <Input label="Data de nascimento" name="birth_date" type="date" />
              <Input label="Telefone" name="phone" />
              <Input label="WhatsApp" name="whatsapp" />
              <Input label="Endereço" name="address" />
              <Input label="Bairro" name="neighborhood" />
              <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Cadastrar paciente</button>
            </form>
          </SectionCard>

          <SectionCard title="Pacientes cadastrados" description="Busca por nome com listagem paginada.">
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={query} placeholder="Buscar paciente" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            <div className="table-responsive">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-3">Nome</th>
                    <th className="px-3 py-3">Telefone</th>
                    <th className="px-3 py-3">Bairro</th>
                    <th className="px-3 py-3">Cadastro</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {patientRows.map((patient: any) => (
                    <tr key={patient.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-semibold text-slate-900">{patient.full_name}</td>
                      <td className="px-3 py-3">{patient.phone || patient.whatsapp || '-'}</td>
                      <td className="px-3 py-3">{patient.neighborhood || '-'}</td>
                      <td className="px-3 py-3">{formatDate(patient.created_at?.slice(0, 10))}</td>
                      <td className="px-3 py-3"><StatusBadge status={patient.status} /></td>
                      <td className="px-3 py-3">
                        <form action={togglePatientStatusAction}>
                          <input type="hidden" name="id" value={patient.id} />
                          <input type="hidden" name="status" value={patient.status} />
                          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">{patient.status === 'active' ? 'Inativar' : 'Ativar'}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!patientRows.length ? <tr><td colSpan={6} className="px-3 py-8"><EmptyState title="Nenhum paciente encontrado" description="Cadastre pacientes ou ajuste a busca para visualizar resultados." /></td></tr> : null}
                </tbody>
              </table>
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/pacientes" query={query} />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Pacientes indisponíveis" description="Não foi possível carregar a listagem de pacientes." />;
  }
}

function Input({ label, name, type = 'text', required = false, placeholder = '' }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );
}