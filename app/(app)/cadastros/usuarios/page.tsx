import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';

const roleLabel: Record<string, string> = { admin: 'Administrador', operator: 'Operador', viewer: 'Leitura' };

type Props = { searchParams?: Promise<{ page?: string; error?: string }> };

export default async function UsuariosPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const page = getPage(params.page);
  const { from, to } = getRange(page);

  try {
    const supabase = await createClient();
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, role, status').order('full_name').range(from, to);
    const profileRows = profiles || [];
    const hasNextPage = profileRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Usuários do sistema" description="Lista de usuários criados no Supabase Auth e sincronizados na tabela de perfis." />
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{params.error}</div> : null}
        <SectionCard title="Usuários cadastrados" description="Crie o usuário no Supabase Auth e ajuste o perfil conforme necessário.">
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
            Para criar o primeiro administrador, use Authentication &gt; Users no Supabase e depois ajuste o perfil como <strong>admin</strong>.
          </div>
          <div className="table-responsive">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">E-mail</th>
                  <th className="px-3 py-3">Perfil</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {profileRows.map((profile: any) => (
                  <tr key={profile.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{profile.full_name || '-'}</td>
                    <td className="px-3 py-3">{profile.email}</td>
                    <td className="px-3 py-3">{roleLabel[profile.role] || profile.role}</td>
                    <td className="px-3 py-3"><StatusBadge status={profile.status} /></td>
                  </tr>
                ))}
                {!profileRows.length ? <tr><td colSpan={4} className="px-3 py-8"><EmptyState title="Nenhum usuário encontrado" description="Os perfis criados no Supabase aparecerão aqui." /></td></tr> : null}
              </tbody>
            </table>
          </div>
          <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/usuarios" />
        </SectionCard>
      </>
    );
  } catch {
    return <EmptyState title="Usuários indisponíveis" description="Não foi possível carregar a listagem de usuários." />;
  }
}