import { DisclosureCard } from '@/components/ui/disclosure-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SectionCard } from '@/components/ui/section-card';
import { getCurrentProfile } from '@/lib/auth';
import { isUserManagementGateUnlocked } from '@/lib/admin-gate';
import { getActiveCities } from '@/lib/app-data';
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
  is_master: boolean | null;
  city_id: string | null;
};

type CityOption = { id: string; name: string; state_uf: string };

export default async function UsuariosPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const page = getPage(params.page);
  const { from, to } = getRange(page);
  const currentProfile = await getCurrentProfile();
  const isMaster = Boolean(currentProfile?.is_master);
  const canManageAuthUsers = isAdminClientConfigured();
  const hasAdminCreationPassword = Boolean(process.env.ADMIN_CREATION_PASSWORD || process.env.ADMIN_PASSWORD);
  const isUnlocked = isMaster ? await isUserManagementGateUnlocked(currentProfile?.id) : false;

  if (!isMaster) {
    return (
      <>
        <PageHeader title="Usuários do sistema" />
        <EmptyState title="Acesso restrito." description="Somente o usuário master cria e administra os acessos." />
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
    const [{ data: profiles, error }, cities] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, status, is_master, city_id').order('full_name').range(from, to),
      getActiveCities(),
    ]);

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar os dados.')} />;
    }

    const profileRows = (profiles || []) as ProfileRow[];
    const cityById = new Map(cities.map((city) => [city.id, `${city.name} / ${city.state_uf}`]));
    const hasNextPage = profileRows.length === DEFAULT_PAGE_SIZE;

    function scopeLabel(profile: ProfileRow) {
      if (profile.is_master) return 'Acesso master · todas as cidades';
      return profile.city_id ? cityById.get(profile.city_id) || 'Cidade removida' : 'Sem cidade';
    }

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
            ) : cities.length ? (
              <form action={createSystemUserAction} className="space-y-3">
                <Input label="Nome completo" name="full_name" required />
                <Input label="E-mail" name="email" type="email" required />
                <Input label="Senha inicial" name="password" type="password" required placeholder="Mínimo 8 caracteres" />
                <RoleField />
                <CityField cities={cities} />
                <MasterField />
                <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Criar usuário</button>
              </form>
            ) : (
              <EmptyState
                title="Cadastre uma cidade primeiro."
                description="Todo gestor precisa de uma cidade. Crie a cidade em Cadastros › Cidades antes de criar os usuários dela."
              />
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
                    description={[profile.email || '', profile.role ? roleLabel[profile.role] || profile.role : '', scopeLabel(profile)].filter(Boolean).join(' · ')}
                    meta={<span className="font-medium text-slate-500">{profile.is_master ? 'Master' : profile.role ? roleLabel[profile.role] || profile.role : '-'}</span>}
                  >
                    <form action={updateSystemUserAction} className="space-y-3">
                      <input type="hidden" name="id" value={profile.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Nome</span>
                          <input name="full_name" defaultValue={profile.full_name || ''} required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">E-mail</span>
                          <input name="email" type="email" defaultValue={profile.email || ''} required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                        <RoleField defaultValue={profile.role || 'viewer'} compact disabled={isCurrentUser} />
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                          <select name="status" defaultValue={profile.status || 'active'} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" disabled={isCurrentUser}>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                          </select>
                          {isCurrentUser ? <input type="hidden" name="status" value="active" /> : null}
                        </div>
                        <CityField cities={cities} defaultValue={profile.city_id || ''} compact disabled={isCurrentUser} />
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Nova senha</span>
                          <input name="password" type="password" placeholder="Opcional" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600" />
                        </div>
                      </div>
                      {isCurrentUser ? (
                        <>
                          <input type="hidden" name="is_master" value="1" />
                          <p className="text-xs text-slate-500">Este é o seu usuário master. Cidade e nível não se aplicam.</p>
                        </>
                      ) : (
                        <MasterField defaultChecked={Boolean(profile.is_master)} />
                      )}
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

function RoleField({ defaultValue = 'viewer', compact = false, disabled = false }: { defaultValue?: string; compact?: boolean; disabled?: boolean }) {
  const labelClass = compact ? 'mb-1 block text-xs font-semibold text-slate-500' : 'mb-1 block text-sm font-semibold text-slate-700';
  const fieldClass = compact
    ? 'w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600';
  return (
    <div>
      <span className={labelClass}>Nível na cidade</span>
      <select name="role" defaultValue={defaultValue} disabled={disabled} className={fieldClass}>
        <option value="admin">Administrador da cidade</option>
        <option value="operator">Operador</option>
        <option value="viewer">Leitura</option>
      </select>
      {disabled ? <input type="hidden" name="role" value={defaultValue} /> : null}
    </div>
  );
}

// Cidade opcional no HTML de propósito: o usuário master não tem cidade, então a
// obrigatoriedade é validada no servidor apenas quando "acesso master" não está marcado.
function CityField({ cities, defaultValue = '', compact = false, disabled = false }: { cities: CityOption[]; defaultValue?: string; compact?: boolean; disabled?: boolean }) {
  const labelClass = compact ? 'mb-1 block text-xs font-semibold text-slate-500' : 'mb-1 block text-sm font-semibold text-slate-700';
  const fieldClass = compact
    ? 'w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600';
  return (
    <div>
      <span className={labelClass}>Cidade</span>
      <select name="city_id" defaultValue={defaultValue} disabled={disabled} className={fieldClass}>
        <option value="">Sem cidade (master)</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>{city.name} / {city.state_uf}</option>
        ))}
      </select>
    </div>
  );
}

function MasterField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" name="is_master" value="1" defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        <span className="block font-semibold text-slate-900">Acesso master</span>
        <span className="block text-xs text-slate-500">Vê e administra todas as cidades. Ignora a cidade selecionada acima.</span>
      </span>
    </label>
  );
}
