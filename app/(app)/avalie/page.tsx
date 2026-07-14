import { EvaluationForm } from '@/components/forms/evaluation-form';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { getEvaluationFormData } from '@/lib/app-data';
import { getCurrentProfile } from '@/lib/auth';
import { getFriendlyErrorMessage, getFriendlySupabaseError } from '@/lib/supabase/errors';
import { createEvaluationAction } from './actions';

type Props = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function AvaliePage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};

  try {
    const currentProfile = await getCurrentProfile();

    if (!currentProfile || currentProfile.role === 'viewer') {
      return (
        <>
          <PageHeader title="Avalie" />
          <EmptyState title="Acesso restrito." />
        </>
      );
    }

    const { patients, units, professionals, error } = await getEvaluationFormData();

    if (error) {
      return <EmptyState title="Não foi possível carregar os dados." description={getFriendlySupabaseError(error, 'Não foi possível carregar os dados.')} />;
    }

    return (
      <>
        <PageHeader title="Avalie" />
        {params.success ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">Avaliação salva com sucesso.</div> : null}
        {params.error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getFriendlyErrorMessage(params.error)}</div> : null}

        {!units.length ? (
          <EmptyState title="Cadastros incompletos." />
        ) : (
          <SectionCard title="Nova avaliação">
            <EvaluationForm patients={patients} units={units} professionals={professionals} action={createEvaluationAction} />
          </SectionCard>
        )}
      </>
    );
  } catch {
    return <EmptyState title="Não foi possível carregar os dados." />;
  }
}
