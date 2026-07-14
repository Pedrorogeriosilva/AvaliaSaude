import type {
  AppRole,
  ContactType,
  HealthUnitType,
  ManifestationType,
  RecordStatus,
  ResolutionStatus,
} from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const APP_ROLES: AppRole[] = ['admin', 'operator', 'viewer'];
export const RECORD_STATUSES: RecordStatus[] = ['active', 'inactive'];
export const HEALTH_UNIT_TYPES: HealthUnitType[] = ['psf', 'hospital', 'other'];
export const CONTACT_TYPES: ContactType[] = ['phone', 'whatsapp', 'in_person'];
export const RESOLUTION_STATUSES: ResolutionStatus[] = ['resolved', 'partial', 'unresolved'];
export const MANIFESTATION_TYPES: ManifestationType[] = ['neutral', 'praise', 'complaint', 'suggestion'];

export function cleanText(value: FormDataEntryValue | null, maxLength = 3000) {
  return String(value || '').trim().slice(0, maxLength);
}

export function optionalText(value: FormDataEntryValue | null, maxLength = 3000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

export function digitsOnly(value: FormDataEntryValue | string | null, maxLength = 32) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

export function isValidCpfFormat(value: string | null | undefined) {
  if (!value) return true;
  return /^\d{11}$/.test(value);
}

export function isValidEmail(value: string | null | undefined) {
  if (!value) return false;
  return value.length <= 254 && EMAIL_REGEX.test(value);
}

export function isValidUuid(value: string | null | undefined) {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export function isValidDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) && value.length >= 10;
}

export function isFutureDate(value: string | null | undefined) {
  if (!isValidDate(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

export function parseScore(value: FormDataEntryValue | null) {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 10) return null;
  return parsed;
}

export function parseNonNegativeInteger(value: FormDataEntryValue | null, max = 1440) {
  if (value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

export function parseFiniteNumber(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assertMaxLength(value: string, maxLength: number) {
  return value.length <= maxLength;
}

export function isValidEnum<T extends string>(value: string, options: readonly T[]): value is T {
  return options.includes(value as T);
}

export function normalizeSearchQuery(value: string | undefined, maxLength = 80) {
  return String(value || '').trim().slice(0, maxLength);
}
