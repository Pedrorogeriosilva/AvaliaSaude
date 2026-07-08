import { EvaluationForm } from '@/components/forms/evaluation-form';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { getEvaluationFormData } from '@/lib/app-data';
import { getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createEvaluationAction } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function AvaliePage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};

  try {
    const { patients, units, professionals, error } = await getEvaluationFormData();

    if (error) {
      return <EmptyState title="Avaliação indisponível" description={getFriendlySupabaseError(error, 'Não foi possível carregar os dados necessários para registrar uma avaliação.')} />;
    }

    return (
      <>
        <PageHeader title="Avalie" description="Registre a avaliação do atendimento e cadastre o paciente no mesmo fluxo, quando necessário." />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">Avaliação salva com sucesso.</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{params.error}</div> : null}

        {!units.length ? (
          <EmptyState title="Cadastros incompletos" description="Cadastre ao menos uma unidade ativa antes de registrar uma avaliação." />
        ) : (
          <SectionCard title="Nova avaliação" description="Os dados do novo paciente ficam salvos automaticamente no cadastro/histórico de pacientes.">
            <EvaluationForm patients={patients} units={units} professionals={professionals} action={createEvaluationAction} />
          </SectionCard>
        )}
      </>
    );
  } catch {
    return <EmptyState title="Avaliação indisponível" description="Não foi possível carregar os dados necessários para registrar uma avaliação. Confira a configuração do Supabase." />;
  }
}
