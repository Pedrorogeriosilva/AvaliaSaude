import { DisclosureCard } from '@/components/ui/disclosure-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { getCurrentProfile } from '@/lib/auth';
import { isUserManagementGateUnlocked } from '@/lib/admin-gate';
import { DEFAULT_PAGE_SIZE, getPage, getRange } from '@/lib/pagination';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { getFriendlyErrorMessage, getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createClient } from '@/lib/supabase/server';
import { createSystemUserAction, deleteSystemUserAction, unlockUserManagementAction, updateSystemUserAction } from '../actions';

const roleLabel: Record<string, string> = { admin: 'Administrador', operator: 'Operador', viewer: 'Leitura' };
const statusLabel: Record<string, string> = { active: 'Ativo', inactive: 'Inativo' };

type Props = { searchParams?: Promise<{ page?: string; error?: string; success?: string }> };

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

export default async function UsuariosPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const page = getPage(params.page);
  const { from, to } = getRange(page);
  const currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const canManageAuthUsers = isAdminClientConfigured();
  const hasAdminCreationPassword = Boolean(process.env.ADMIN_CREATION_PASSWORD || process.env.ADMIN_PASSWORD);
  const isUnlocked = isAdmin ? await isUserManagementGateUnlocked(currentProfile?.id) : false;

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Usuários do sistema" />
        <EmptyState title="Acesso restrito." />
      </>
    );
  }

  if (!hasAdminCreationPassword) {
    return (
      <>
        <PageHeader title="Usuários do sistema" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Configure <strong>ADMIN_CREATION_PASSWORD</strong>.
        </div>
      </>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <PageHeader title="Usuários do sistema" />
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}
        <div className="mx-auto max-w-md">
          <SectionCard title="Confirmação de segurança">
            <form action={unlockUserManagementAction} className="space-y-4">
              <Input label="Senha adicional de administrador" name="admin_creation_password" type="password" required placeholder="Informe a senha extra" />
              <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Liberar acesso</button>
            </form>
          </SectionCard>
        </div>
      </>
    );
  }

  try {
    const supabase = canManageAuthUsers ? createAdminClient() : await createClient();
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, status')
      .order('full_name')
      .range(from, to);

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar os dados.')} />;
    }

    const profileRows = (profiles || []) as ProfileRow[];
    const hasNextPage = profileRows.length === DEFAULT_PAGE_SIZE;

    return (
      <>
        <PageHeader title="Usuários do sistema" />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{params.success}</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <SectionCard title="Novo usuário">
            {!canManageAuthUsers ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Configuração do servidor pendente.
              </div>
            ) : (
              <form action={createSystemUserAction} className="space-y-3">
                <Input label="Nome completo" name="full_name" required />
                <Input label="E-mail" name="email" type="email" required />
                <Input label="Senha inicial" name="password" type="password" required placeholder="Mínimo 8 caracteres" />
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">Perfil</span>
                  <select name="role" defaultValue="viewer" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600">
                    <option value="admin">Administrador</option>
                    <option value="operator">Operador</option>
                    <option value="viewer">Leitura</option>
                  </select>
                </label>
                <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Criar usuário</button>
              </form>
            )}
          </SectionCard>

          <SectionCard title="Usuários cadastrados">
            <div className="space-y-4">
              {profileRows.map((profile) => {
                const isCurrentUser = profile.id === currentProfile?.id;
                return (
                  <DisclosureCard
                    key={profile.id}
                    title={profile.full_name || '-'}
                    description={[profile.email || '', profile.role ? roleLabel[profile.role] || profile.role : '', profile.status ? statusLabel[profile.status] || profile.status : ''].filter(Boolean).join(' · ')}
                    meta={<span className="font-medium text-slate-500">{profile.role ? roleLabel[profile.role] || profile.role : '-'}</span>}
                  >
                    <form action={updateSystemUserAction} className="space-y-3">
                      <input type="hidden" name="id" value={profile.id} />
                      <div className="grid gap-3 xl:grid-cols-[1.1fr_1.2fr_150px_130px_170px] xl:items-start">
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Nome</span>
                          <input name="full_name" defaultValue={profile.full_name || ''} required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">E-mail</span>
                          <input name="email" type="email" defaultValue={profile.email || ''} required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Perfil</span>
                          <select name="role" defaultValue={profile.role || 'viewer'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" disabled={isCurrentUser}>
                            <option value="admin">Administrador</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Leitura</option>
                          </select>
                          {isCurrentUser ? <input type="hidden" name="role" value="admin" /> : null}
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                          <select name="status" defaultValue={profile.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" disabled={isCurrentUser}>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                          </select>
                          {isCurrentUser ? <input type="hidden" name="status" value="active" /> : null}
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Nova senha</span>
                          <input name="password" type="password" placeholder="Opcional" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                      </div>
                      <div className="flex justify-end border-t border-slate-100 pt-3">
                        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Salvar alterações</button>
                      </div>
                    </form>

                    {!isCurrentUser ? (
                      <form action={deleteSystemUserAction} className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 md:grid-cols-[1fr_120px] md:items-center">
                        <input type="hidden" name="id" value={profile.id} />
                        <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                          <input type="checkbox" name="confirm_delete" value="1" required />
                          Confirmo que desejo excluir este usuário definitivamente.
                        </label>
                        <button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                      </form>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">Não é permitido remover o próprio acesso.</p>
                    )}
                  </DisclosureCard>
                );
              })}
              {!profileRows.length ? <EmptyState title="Nenhum registro encontrado." /> : null}
            </div>
            <PaginationControls page={page} hasNextPage={hasNextPage} basePath="/cadastros/usuarios" />
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
