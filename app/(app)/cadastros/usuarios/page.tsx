import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { createClient } from '@/lib/supabase/server';

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Leitura',
};

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');

  return (
    <>
      <PageHeader
        title="Usuários do sistema"
        description="Lista de usuários criados no Supabase Auth e sincronizados na tabela de perfis."
      />

      <SectionCard title="Usuários cadastrados" description="Na primeira versão, crie o usuário no Supabase Auth e ajuste o perfil via SQL ou tela administrativa futura.">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          Para criar o primeiro administrador: crie o usuário em Authentication &gt; Users no Supabase e execute o comando informado no README para definir o perfil como <strong>admin</strong>.
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
              {(profiles || []).map((profile: any) => (
                <tr key={profile.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{profile.full_name}</td>
                  <td className="px-3 py-3">{profile.email}</td>
                  <td className="px-3 py-3">{roleLabel[profile.role] || profile.role}</td>
                  <td className="px-3 py-3"><StatusBadge status={profile.status} /></td>
                </tr>
              ))}
              {!profiles?.length ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
