import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { createClient } from '@/lib/supabase/server';
import { formatInteger, formatNumber, labelUnitType } from '@/lib/format';

export default async function RankingPage() {
  const supabase = await createClient();

  const [{ data: bestUnits }, { data: worstUnits }, { data: bestProfessionals }, { data: worstProfessionals }] = await Promise.all([
    supabase.from('v_unit_metrics').select('*').gt('total_evaluations', 0).order('avg_general_score', { ascending: false }).limit(10),
    supabase.from('v_unit_metrics').select('*').gt('total_evaluations', 0).order('avg_general_score', { ascending: true }).limit(10),
    supabase.from('v_professional_metrics').select('*').gt('total_evaluations', 0).order('avg_professional_score', { ascending: false }).limit(10),
    supabase.from('v_professional_metrics').select('*').gt('total_evaluations', 0).order('avg_professional_score', { ascending: true }).limit(10),
  ]);

  return (
    <>
      <PageHeader
        title="Ranking"
        description="Comparativo de desempenho das unidades e profissionais avaliados."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Melhores unidades" description="Ordenado pela maior nota geral média.">
          <RankingTable
            rows={(bestUnits || []).map((unit: any) => ({
              id: unit.health_unit_id,
              name: unit.health_unit_name,
              subtitle: `${labelUnitType(unit.health_unit_type)} · ${formatInteger(unit.total_evaluations)} avaliações`,
              score: unit.avg_general_score,
            }))}
          />
        </SectionCard>

        <SectionCard title="Unidades com atenção necessária" description="Ordenado pela menor nota geral média.">
          <RankingTable
            rows={(worstUnits || []).map((unit: any) => ({
              id: unit.health_unit_id,
              name: unit.health_unit_name,
              subtitle: `${labelUnitType(unit.health_unit_type)} · ${formatInteger(unit.total_evaluations)} avaliações`,
              score: unit.avg_general_score,
            }))}
          />
        </SectionCard>

        <SectionCard title="Profissionais mais bem avaliados" description="Ranking individual por nota média.">
          <RankingTable
            rows={(bestProfessionals || []).map((professional: any) => ({
              id: professional.professional_id,
              name: professional.professional_name,
              subtitle: `${professional.position} · ${professional.health_unit_name}`,
              score: professional.avg_professional_score,
            }))}
          />
        </SectionCard>

        <SectionCard title="Profissionais com menor média" description="Ajuda a identificar pontos de treinamento e melhoria.">
          <RankingTable
            rows={(worstProfessionals || []).map((professional: any) => ({
              id: professional.professional_id,
              name: professional.professional_name,
              subtitle: `${professional.position} · ${professional.health_unit_name}`,
              score: professional.avg_professional_score,
            }))}
          />
        </SectionCard>
      </div>
    </>
  );
}

function RankingTable({ rows }: { rows: { id: string; name: string; subtitle: string; score: string | number | null }[] }) {
  if (!rows.length) {
    return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Sem avaliações suficientes para ranking.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
              {index + 1}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-500">{row.subtitle}</div>
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700">{formatNumber(row.score)}</div>
        </div>
      ))}
    </div>
  );
}
