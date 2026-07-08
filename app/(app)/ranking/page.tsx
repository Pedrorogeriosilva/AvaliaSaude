import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { createClient } from '@/lib/supabase/server';
import { formatInteger, formatNumber, labelUnitType } from '@/lib/format';

export default async function RankingPage() {
  try {
    const supabase = await createClient();
    const [{ data: bestUnits }, { data: worstUnits }, { data: bestProfessionals }, { data: worstProfessionals }] = await Promise.all([
      supabase.from('v_unit_metrics').select('health_unit_id, health_unit_name, health_unit_type, total_evaluations, avg_general_score').gt('total_evaluations', 0).order('avg_general_score', { ascending: false }).limit(10),
      supabase.from('v_unit_metrics').select('health_unit_id, health_unit_name, health_unit_type, total_evaluations, avg_general_score').gt('total_evaluations', 0).order('avg_general_score', { ascending: true }).limit(10),
      supabase.from('v_professional_metrics').select('professional_id, professional_name, position, health_unit_name, avg_professional_score').gt('total_evaluations', 0).order('avg_professional_score', { ascending: false }).limit(10),
      supabase.from('v_professional_metrics').select('professional_id, professional_name, position, health_unit_name, avg_professional_score').gt('total_evaluations', 0).order('avg_professional_score', { ascending: true }).limit(10),
    ]);

    return (
      <>
        <PageHeader title="Ranking" description="Comparativo de desempenho das unidades e profissionais avaliados." />
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Melhores unidades" description="Ordenado pela maior nota geral média.">
            <RankingTable rows={(bestUnits || []).map((unit: any) => ({ id: unit.health_unit_id, name: unit.health_unit_name, subtitle: `${labelUnitType(unit.health_unit_type)} · ${formatInteger(unit.total_evaluations)} avaliações`, score: unit.avg_general_score }))} emptyText="Sem avaliações suficientes para ranking." />
          </SectionCard>
          <SectionCard title="Unidades com atenção necessária" description="Ordenado pela menor nota geral média.">
            <RankingTable rows={(worstUnits || []).map((unit: any) => ({ id: unit.health_unit_id, name: unit.health_unit_name, subtitle: `${labelUnitType(unit.health_unit_type)} · ${formatInteger(unit.total_evaluations)} avaliações`, score: unit.avg_general_score }))} emptyText="Sem avaliações suficientes para ranking." />
          </SectionCard>
          <SectionCard title="Profissionais mais bem avaliados" description="Ranking individual por nota média.">
            <RankingTable rows={(bestProfessionals || []).map((professional: any) => ({ id: professional.professional_id, name: professional.professional_name, subtitle: `${professional.position} · ${professional.health_unit_name}`, score: professional.avg_professional_score }))} emptyText="Nenhum profissional avaliado ainda." />
          </SectionCard>
          <SectionCard title="Profissionais com menor média" description="Ajuda a identificar pontos de treinamento e melhoria.">
            <RankingTable rows={(worstProfessionals || []).map((professional: any) => ({ id: professional.professional_id, name: professional.professional_name, subtitle: `${professional.position} · ${professional.health_unit_name}`, score: professional.avg_professional_score }))} emptyText="Nenhum profissional avaliado ainda." />
          </SectionCard>
        </div>
      </>
    );
  } catch {
    return <EmptyState title="Ranking indisponível" description="Não foi possível carregar o ranking no momento." />;
  }
}

function RankingTable({ rows, emptyText }: { rows: { id: string; name: string; subtitle: string; score: string | number | null }[]; emptyText: string }) {
  if (!rows.length) {
    return <EmptyState title="Sem dados para ranking" description={emptyText} />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{index + 1}</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-500">{row.subtitle}</div>
            </div>
          </div>
          <div className="text-xl font-semibold text-blue-700">{formatNumber(row.score)}</div>
        </div>
      ))}
    </div>
  );
}