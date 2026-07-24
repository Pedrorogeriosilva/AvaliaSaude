'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthUnit, Patient, Professional } from '@/types';

type PatientOption = Pick<Patient, 'id' | 'full_name' | 'cpf'>;

type Props = {
  patients: PatientOption[];
  units: Pick<HealthUnit, 'id' | 'name'>[];
  professionals: Pick<Professional, 'id' | 'full_name' | 'position' | 'health_unit_id' | 'work_schedule'>[];
  action: (formData: FormData) => void | Promise<void>;
};

type ReviewData = {
  patientSummary: string;
  attendanceDate: string;
  unitName: string;
  contactType: string;
  resolution: string;
  scores: { label: string; value: string }[];
  professionalScores: { name: string; position: string; score: string }[];
  manifestation: string;
  generalNotes: string;
};

type EvaluationFormState = {
  new_patient_full_name: string;
  new_patient_cpf: string;
  new_patient_phone: string;
  new_patient_whatsapp: string;
  new_patient_address: string;
  new_patient_neighborhood: string;
  attendance_date: string;
  contact_type: string;
  resolution: string;
  general_score: string;
  structure_score: string;
  wait_time_score: string;
  manifestation: string;
  general_notes: string;
  professionalScores: Record<string, string>;
};

const scoreOptions = Array.from({ length: 11 }, (_, index) => index);
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600';
const smallFieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600';
const generalScoreFields = [
  ['general_score', 'Nota geral'],
  ['structure_score', 'Estrutura'],
  ['wait_time_score', 'Tempo de espera'],
] as const;
const initialFormState: EvaluationFormState = {
  new_patient_full_name: '',
  new_patient_cpf: '',
  new_patient_phone: '',
  new_patient_whatsapp: '',
  new_patient_address: '',
  new_patient_neighborhood: '',
  attendance_date: '',
  contact_type: 'phone',
  resolution: 'resolved',
  general_score: '',
  structure_score: '',
  wait_time_score: '',
  manifestation: 'neutral',
  general_notes: '',
  professionalScores: {},
};

const contactTypeLabels: Record<string, string> = {
  phone: 'Ligação',
  whatsapp: 'WhatsApp',
  in_person: 'Presencial',
};

const resolutionLabels: Record<string, string> = {
  resolved: 'Resolvido',
  partial: 'Parcialmente resolvido',
  unresolved: 'Não resolvido',
};

const manifestationLabels: Record<string, string> = {
  neutral: 'Observação',
  praise: 'Elogio',
  complaint: 'Reclamação',
  suggestion: 'Sugestão',
};

const scoreFieldLabels: Record<string, string> = {
  general_score: 'Nota geral',
  structure_score: 'Estrutura',
  wait_time_score: 'Tempo de espera',
};

export function EvaluationForm({ patients, units, professionals, action }: Props) {
  const [unitId, setUnitId] = useState('');
  const [patientMode, setPatientMode] = useState<'new' | 'existing'>('new');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>(patients);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [formState, setFormState] = useState<EvaluationFormState>(initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassReviewRef = useRef(false);

  const filteredProfessionals = useMemo(
    () => professionals.filter((professional) => professional.health_unit_id === unitId),
    [professionals, unitId],
  );

  const knownPatients = useMemo(() => {
    return Array.from(new Map([...patientResults, ...patients].map((patient) => [patient.id, patient])).values());
  }, [patientResults, patients]);

  const selectedPatient = useMemo(
    () => knownPatients.find((patient) => patient.id === selectedPatientId) || null,
    [knownPatients, selectedPatientId],
  );

  useEffect(() => {
    if (patientMode !== 'existing') return;

    const query = patientSearch.trim();
    const controller = new AbortController();

    if (query.length < 2) {
      setPatientResults(patients);
      setPatientLoading(false);
      return () => controller.abort();
    }

    const timeout = window.setTimeout(async () => {
      try {
        setPatientLoading(true);
        const response = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { patients?: PatientOption[] };
        setPatientResults(payload.patients || []);
      } catch {
        if (!controller.signal.aborted) {
          setPatientResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPatientLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [patientMode, patientSearch, patients]);

  function updateField<K extends Exclude<keyof EvaluationFormState, 'professionalScores'>>(
    field: K,
    value: EvaluationFormState[K],
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    resetReview();
  }

  function updateProfessionalScore(id: string, value: string) {
    setFormState((current) => ({
      ...current,
      professionalScores: {
        ...current.professionalScores,
        [id]: value,
      },
    }));
    resetReview();
  }

  function toggleProfessional(id: string) {
    setSelectedProfessionals((current) => {
      const shouldRemove = current.includes(id);

      if (shouldRemove) {
        setFormState((formCurrent) => {
          if (!(id in formCurrent.professionalScores)) return formCurrent;
          const professionalScores = { ...formCurrent.professionalScores };
          delete professionalScores[id];
          return { ...formCurrent, professionalScores };
        });
      }

      return shouldRemove ? current.filter((item) => item !== id) : [...current, id];
    });
    resetReview();
  }

  function buildReviewData(formData: FormData): ReviewData {
    const patientSummary = (() => {
      if (patientMode === 'new') {
        const name = String(formData.get('new_patient_full_name') || '').trim();
        const cpf = String(formData.get('new_patient_cpf') || '').trim();
        const phone = String(formData.get('new_patient_phone') || '').trim();
        const neighborhood = String(formData.get('new_patient_neighborhood') || '').trim();
        const extras = [cpf ? `CPF ${cpf}` : '', phone ? `Tel. ${phone}` : '', neighborhood].filter(Boolean).join(' · ');
        return extras ? `${name} · ${extras}` : name;
      }

      const patientId = String(formData.get('patient_id') || '');
      const patient = knownPatients.find((item) => item.id === patientId);
      if (!patient) return 'Paciente não identificado';
      return patient.cpf ? `${patient.full_name} · CPF ${patient.cpf}` : patient.full_name;
    })();

    const unitName = units.find((unit) => unit.id === String(formData.get('health_unit_id') || ''))?.name || 'Unidade não identificada';

    const professionalScores = Array.from(formData.getAll('professional_ids'))
      .map((id) => String(id))
      .map((id) => {
        const professional = professionals.find((item) => item.id === id);
        return {
          name: professional?.full_name || 'Profissional',
          position: professional?.position || 'Sem cargo informado',
          score: String(formData.get(`score_${id}`) || '-'),
        };
      });

    const scores = Object.entries(scoreFieldLabels).map(([name, label]) => ({
      label,
      value: String(formData.get(name) || '-'),
    }));

    return {
      patientSummary,
      attendanceDate: String(formData.get('attendance_date') || '-'),
      unitName,
      contactType: contactTypeLabels[String(formData.get('contact_type') || '')] || '-',
      resolution: resolutionLabels[String(formData.get('resolution') || '')] || '-',
      scores,
      professionalScores,
      manifestation: manifestationLabels[String(formData.get('manifestation') || '')] || '-',
      generalNotes: String(formData.get('general_notes') || '').trim() || 'Sem observações adicionais.',
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (bypassReviewRef.current) {
      bypassReviewRef.current = false;
      return;
    }

    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setReviewData(buildReviewData(formData));
    setReviewVisible(true);
    setTimeout(() => {
      document.getElementById('review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function confirmSubmission() {
    bypassReviewRef.current = true;
    formRef.current?.requestSubmit();
  }

  function resetReview() {
    setReviewVisible(false);
    setReviewData(null);
  }

  function resetExistingPatientState() {
    setPatientSearch('');
    setPatientResults(patients);
    setSelectedPatientId('');
  }

  function handleUnitChange(nextUnitId: string) {
    setUnitId(nextUnitId);
    setSelectedProfessionals([]);
    setFormState((current) => ({
      ...current,
      professionalScores: {},
    }));
    resetReview();
  }

  function resetForm() {
    setSelectedProfessionals([]);
    setUnitId('');
    setPatientMode('new');
    setFormState(initialFormState);
    resetExistingPatientState();
    resetReview();
  }

  return (
    <form ref={formRef} action={action} className="space-y-6" onSubmit={handleSubmit}>
      <input type="hidden" name="patient_mode" value={patientMode} />
      <input type="hidden" name="patient_id" value={selectedPatientId} />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Paciente avaliado</h2>
          </div>
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setPatientMode('new');
                resetExistingPatientState();
                resetReview();
              }}
              className={patientMode === 'new' ? 'rounded-md bg-white px-3 py-2 text-blue-700 shadow-sm' : 'rounded-md px-3 py-2 text-slate-600'}
            >
              Novo paciente
            </button>
            <button
              type="button"
              onClick={() => {
                setPatientMode('existing');
                resetExistingPatientState();
                resetReview();
              }}
              className={patientMode === 'existing' ? 'rounded-md bg-white px-3 py-2 text-blue-700 shadow-sm' : 'rounded-md px-3 py-2 text-slate-600'}
            >
              Já cadastrado
            </button>
          </div>
        </div>

        {patientMode === 'new' ? (
          <div key="new-patient-fields" className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nome completo</span>
              <input
                name="new_patient_full_name"
                required
                maxLength={120}
                value={formState.new_patient_full_name}
                onChange={(event) => updateField('new_patient_full_name', event.target.value)}
                className={smallFieldClass}
                placeholder="Nome do paciente"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">CPF</span>
              <input
                name="new_patient_cpf"
                inputMode="numeric"
                maxLength={11}
                value={formState.new_patient_cpf}
                onChange={(event) => updateField('new_patient_cpf', event.target.value)}
                placeholder="Somente números"
                className={smallFieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Telefone</span>
              <input
                name="new_patient_phone"
                maxLength={30}
                value={formState.new_patient_phone}
                onChange={(event) => updateField('new_patient_phone', event.target.value)}
                className={smallFieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">WhatsApp</span>
              <input
                name="new_patient_whatsapp"
                maxLength={30}
                value={formState.new_patient_whatsapp}
                onChange={(event) => updateField('new_patient_whatsapp', event.target.value)}
                className={smallFieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Endereço</span>
              <input
                name="new_patient_address"
                maxLength={200}
                value={formState.new_patient_address}
                onChange={(event) => updateField('new_patient_address', event.target.value)}
                className={smallFieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Bairro</span>
              <input
                name="new_patient_neighborhood"
                maxLength={100}
                value={formState.new_patient_neighborhood}
                onChange={(event) => updateField('new_patient_neighborhood', event.target.value)}
                className={smallFieldClass}
              />
            </label>
          </div>
        ) : (
          <div key="existing-patient-fields" className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Buscar paciente cadastrado</span>
              <input
                value={patientSearch}
                onChange={(event) => {
                  setPatientSearch(event.target.value);
                  setSelectedPatientId('');
                  resetReview();
                }}
                className={fieldClass}
                placeholder="Digite nome ou CPF"
              />
            </label>

            {selectedPatient ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                <div className="font-semibold">{selectedPatient.full_name}</div>
                <div className="text-xs text-blue-700">{selectedPatient.cpf ? `CPF ${selectedPatient.cpf}` : 'CPF não informado'}</div>
              </div>
            ) : null}

            <div className="space-y-2">
              {patientLoading ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Buscando pacientes...</div>
              ) : patientResults.length ? (
                patientResults.map((patient) => {
                  const active = patient.id === selectedPatientId;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setPatientSearch(patient.full_name);
                        resetReview();
                      }}
                      className={
                        active
                          ? 'w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-3 text-left'
                          : 'w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-blue-200 hover:bg-slate-50'
                      }
                    >
                      <div className="text-sm font-semibold text-slate-900">{patient.full_name}</div>
                      <div className="text-xs text-slate-500">{patient.cpf ? `CPF ${patient.cpf}` : 'CPF não informado'}</div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhum paciente encontrado.</div>
              )}
            </div>

            {!patients.length ? <span className="block text-xs text-slate-500">Nenhum paciente encontrado.</span> : null}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Unidade / PSF</span>
          <select
            name="health_unit_id"
            required
            value={unitId}
            onChange={(event) => handleUnitChange(event.target.value)}
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
          <input
            name="attendance_date"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={formState.attendance_date}
            onChange={(event) => updateField('attendance_date', event.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de contato</span>
          <select
            name="contact_type"
            required
            value={formState.contact_type}
            onChange={(event) => updateField('contact_type', event.target.value)}
            className={fieldClass}
          >
            <option value="phone">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="in_person">Presencial</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Resolução</span>
          <select
            name="resolution"
            required
            value={formState.resolution}
            onChange={(event) => updateField('resolution', event.target.value)}
            className={fieldClass}
          >
            <option value="resolved">Resolvido</option>
            <option value="partial">Parcialmente</option>
            <option value="unresolved">Não resolvido</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Notas gerais do atendimento</h2>
        {/* Três notas de 0 a 10: Nota geral, Estrutura e Tempo de espera. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {generalScoreFields.map(([name, label]) => (
            <label key={name} className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
              <select
                name={name}
                required
                value={formState[name]}
                onChange={(event) => updateField(name, event.target.value)}
                className={fieldClass}
              >
                <option value="">Nota</option>
                {scoreOptions.map((score) => <option key={score} value={score}>{score}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Profissionais da unidade selecionada</h2>

        <div className="mt-4 space-y-3">
          {!unitId ? (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Selecione uma unidade.</div>
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
                    value={formState.professionalScores[professional.id] ?? ''}
                    onChange={(event) => updateProfessionalScore(professional.id, event.target.value)}
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
          <select
            name="manifestation"
            required
            value={formState.manifestation}
            onChange={(event) => updateField('manifestation', event.target.value)}
            className={fieldClass}
          >
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
            maxLength={2000}
            placeholder="Campo opcional"
            value={formState.general_notes}
            onChange={(event) => updateField('general_notes', event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600"
          />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 md:flex-row md:justify-end">
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Limpar
        </button>
        <button className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800">
          Revisar avaliação
        </button>
      </div>

      {reviewVisible && reviewData ? (
        <div id="review-panel" className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Revisão antes do envio</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/80 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Resumo do atendimento</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <ReviewItem label="Paciente" value={reviewData.patientSummary} />
                <ReviewItem label="Unidade" value={reviewData.unitName} />
                <ReviewItem label="Data" value={reviewData.attendanceDate} />
                <ReviewItem label="Contato" value={reviewData.contactType} />
                <ReviewItem label="Resolução" value={reviewData.resolution} />
                <ReviewItem label="Manifestação" value={reviewData.manifestation} />
              </dl>
            </div>

            <div className="rounded-xl border border-white/80 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Notas gerais</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {reviewData.scores.map((score) => (
                  <div key={score.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{score.label}</span>
                    <span className="mt-1 block text-base font-semibold text-slate-900">{score.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/80 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Profissionais selecionados</h3>
            {reviewData.professionalScores.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {reviewData.professionalScores.map((professional) => (
                  <div key={professional.name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <div className="font-semibold text-slate-900">{professional.name}</div>
                    <div className="text-slate-500">{professional.position}</div>
                    <div className="mt-2 text-slate-700">Nota individual: <span className="font-semibold text-blue-700">{professional.score}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Nenhum profissional foi selecionado nesta avaliação.</p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/80 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Observações gerais</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{reviewData.generalNotes}</p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <button type="button" onClick={resetReview} className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-white">
              Voltar e editar
            </button>
            <button type="button" onClick={confirmSubmission} className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800">
              Confirmar e enviar avaliação
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-start">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}
