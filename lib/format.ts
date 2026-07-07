export function formatNumber(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === '') return '0';
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '0';
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function labelStatus(value: string | null | undefined) {
  return value === 'active' ? 'Ativo' : 'Inativo';
}

export function labelUnitType(value: string | null | undefined) {
  const map: Record<string, string> = {
    psf: 'PSF',
    hospital: 'Hospital',
    other: 'Outro',
  };
  return value ? map[value] ?? value : '-';
}

export function labelResolution(value: string | null | undefined) {
  const map: Record<string, string> = {
    resolved: 'Resolvido',
    partial: 'Parcialmente resolvido',
    unresolved: 'Não resolvido',
  };
  return value ? map[value] ?? value : '-';
}

export function labelManifestation(value: string | null | undefined) {
  const map: Record<string, string> = {
    praise: 'Elogio',
    complaint: 'Reclamação',
    suggestion: 'Sugestão',
    neutral: 'Observação',
  };
  return value ? map[value] ?? value : '-';
}
