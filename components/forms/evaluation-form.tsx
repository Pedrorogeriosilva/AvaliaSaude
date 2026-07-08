'use client';

import { useMemo, useState } from 'react';
import type { HealthUnit, Patient, Professional } from '@/types';

type PatientOption = Pick<Patient, 'id' | 'full_name' | 'cpf'>;

type Props = {
  patients: PatientOption[];
  units: Pick<HealthUnit, 'id' | 'name'>[];
  professionals: Pick<Professional, 'id' | 'full_name' | 'position' | 'health_unit_id' | 'work_schedule'>[];
  action: (formData: FormData) => void | Promise<void>;
};

const scoreOptions = Array.from({ length: 11 }, (_, index) => index);
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600';
const smallFieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600';

export function EvaluationForm({ patients, units, professionals, action }: Props) {
  const [unitId, setUnitId] = useState('');
  const [patientMode, setPatientMode] = useState<'new' | 'existing'>('new');
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);

  const filteredProfessionals = useMemo(
    () => professionals.filter((professional) => professional.health_unit_id === unitId),
    [professionals, unitId],
  );

  function toggleProfessional(id: string) {
    setSelectedProfessionals((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <form
      action={action}
      className="space-y-6"
      onSubmit={(event) => {
        const ok = window.confirm('Confirmar salvamento desta avaliação?');
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="patient_mode" value={patientMode} />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Paciente avaliado</h2>
            <p className="mt-1 text-sm text-slate-500">Cadastre o paciente durante a avaliação ou vincule um paciente já existente.</p>
          </div>
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setPatientMode('new')}
              className={patientMode === 'new' ? 'rounded-md bg-white px-3 py-2 text-blue-700 shadow-sm' : 'rounded-md px-3 py-2 text-slate-600'}
            >
              Novo paciente
            </button>
            <button
              type="button"
              onClick={() => setPatientMode('existing')}
              className={patientMode === 'existing' ? 'rounded-md bg-white px-3 py-2 text-blue-700 shadow-sm' : 'rounded-md px-3 py-2 text-slate-600'}
            >
              Já cadastrado
            </button>
          </div>
        </div>

        {patientMode === 'new' ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nome completo</span>
              <input name="new_patient_full_name" required className={smallFieldClass} placeholder="Nome do paciente" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">CPF</span>
              <input name="new_patient_cpf" inputMode="numeric" placeholder="Somente números" className={smallFieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nascimento</span>
              <input name="new_patient_birth_date" type="date" className={smallFieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Telefone</span>
              <input name="new_patient_phone" className={smallFieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">WhatsApp</span>
              <input name="new_patient_whatsapp" className={smallFieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Endereço</span>
              <input name="new_patient_address" className={smallFieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Bairro</span>
              <input name="new_patient_neighborhood" className={smallFieldClass} />
            </label>
          </div>
        ) : (
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Paciente cadastrado</span>
            <select name="patient_id" required={patientMode === 'existing'} className={fieldClass}>
              <option value="">Selecione</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.full_name}{patient.cpf ? ` · CPF ${patient.cpf}` : ''}</option>
              ))}
            </select>
            {!patients.length ? <span className="mt-1 block text-xs text-slate-500">Nenhum paciente recente encontrado. Use a opção Novo paciente.</span> : null}
          </label>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Unidade / PSF</span>
          <select
            name="health_unit_id"
            required
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              setSelectedProfessionals([]);
            }}
            className={fieldClass}
          >
            <option value="">Selecione</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Data do atendimento</span>
          <input name="attendance_date" type="date" required className={fieldClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de contato</span>
          <select name="contact_type" required className={fieldClass}>
            <option value="phone">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="in_person">Presencial</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Tempo de espera</span>
          <input name="wait_time_minutes" type="number" min="0" placeholder="Minutos" className={fieldClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Resolução</span>
          <select name="resolution" required className={fieldClass}>
            <option value="resolved">Resolvido</option>
            <option value="partial">Parcialmente</option>
            <option value="unresolved">Não resolvido</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Notas gerais do atendimento</h2>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ['general_score', 'Nota geral'],
            ['satisfaction_score', 'Satisfação'],
            ['structure_score', 'Estrutura'],
            ['clarity_score', 'Clareza'],
            ['service_quality_score', 'Qualidade'],
          ].map(([name, label]) => (
            <label key={name} className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
              <select name={name} required className={fieldClass}>
                <option value="">Nota</option>
                {scoreOptions.map((score) => <option key={score} value={score}>{score}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Profissionais da unidade selecionada</h2>
        <p className="mt-1 text-sm text-slate-500">Selecione apenas os profissionais envolvidos no atendimento e informe a nota individual.</p>

        <div className="mt-4 space-y-3">
          {!unitId ? (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Selecione uma unidade para listar os profissionais.</div>
          ) : filteredProfessionals.length ? (
            filteredProfessionals.map((professional) => {
              const checked = selectedProfessionals.includes(professional.id);
              return (
                <div key={professional.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_140px] md:items-center">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="professional_ids"
                      value={professional.id}
                      checked={checked}
                      onChange={() => toggleProfessional(professional.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{professional.full_name}</span>
                      <span className="block text-sm text-slate-500">{professional.position} · {professional.work_schedule || 'Horário não informado'}</span>
                    </span>
                  </label>
                  <select
                    name={`score_${professional.id}`}
                    disabled={!checked}
                    required={checked}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none disabled:bg-slate-100"
                  >
                    <option value="">Nota</option>
                    {scoreOptions.map((score) => <option key={score} value={score}>{score}</option>)}
                  </select>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Nenhum profissional ativo cadastrado nesta unidade.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de manifestação</span>
          <select name="manifestation" required className={fieldClass}>
            <option value="neutral">Observação</option>
            <option value="praise">Elogio</option>
            <option value="complaint">Reclamação</option>
            <option value="suggestion">Sugestão</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Observações gerais</span>
          <textarea
            name="general_notes"
            rows={4}
            placeholder="Descreva elogios, reclamações ou informações adicionais. Campo opcional."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600"
          />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 md:flex-row md:justify-end">
        <button type="reset" className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100">
          Limpar
        </button>
        <button className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800">
          Salvar avaliação
        </button>
      </div>
    </form>
  );
}
