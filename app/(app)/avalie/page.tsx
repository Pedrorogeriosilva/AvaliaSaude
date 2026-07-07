import { EvaluationForm } from '@/components/forms/evaluation-form';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { createClient } from '@/lib/supabase/server';
import type { HealthUnit, Patient, Professional } from '@/types';
import { createEvaluationAction } from './actions';

type Props = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function AvaliePage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();

  const [{ data: patients }, { data: units }, { data: professionals }] = await Promise.all([
    supabase.from('patients').select('*').eq('status', 'active').order('full_name'),
    supabase.from('health_units').select('*').eq('status', 'active').order('name'),
    supabase.from('professionals').select('*').eq('status', 'active').order('full_name'),
  ]);

  return (
    <>
      <PageHeader
        title="Avalie"
        description="Registre uma avaliação de atendimento realizada pela equipe responsável pelas métricas do município."
      />

      {params.success ? (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          Avaliação salva com sucesso.
        </div>
      ) : null}

      {params.error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      ) : null}

      <SectionCard title="Nova avaliação" description="Preencha os dados do atendimento, selecione os profissionais envolvidos e salve a pesquisa.">
        <EvaluationForm
          patients={(patients || []) as Patient[]}
          units={(units || []) as HealthUnit[]}
          professionals={(professionals || []) as Professional[]}
          action={createEvaluationAction}
        />
      </SectionCard>
    </>
  );
}