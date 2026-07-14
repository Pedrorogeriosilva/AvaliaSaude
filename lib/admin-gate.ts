import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const ADMIN_USERS_GATE_COOKIE = 'avalia_admin_users_gate';
const ADMIN_USERS_GATE_ATTEMPTS_COOKIE = 'avalia_admin_users_gate_attempts';
const ADMIN_USERS_GATE_MAX_AGE = 20 * 60;
const ADMIN_USERS_GATE_ATTEMPT_WINDOW = 10 * 60;
const ADMIN_USERS_GATE_ATTEMPT_LIMIT = 5;
const ADMIN_USERS_GATE_LOCK_SECONDS = 10 * 60;

type AttemptState = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

export function getAdminCreationPassword() {
  return String(process.env.ADMIN_CREATION_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
}

function getAdminGateSecret() {
  return String(process.env.ADMIN_GATE_SECRET || getAdminCreationPassword()).trim();
}

function signValue(value: string) {
  const secret = getAdminGateSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(value).digest('hex');
}

function encodeSignedPayload(payload: string) {
  const signature = signValue(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function decodeSignedPayload(rawValue: string | undefined | null) {
  if (!rawValue) return null;

  const lastDot = rawValue.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const payload = rawValue.slice(0, lastDot);
  const signature = rawValue.slice(lastDot + 1);
  const expectedSignature = signValue(payload);

  if (!expectedSignature || !safeEquals(signature, expectedSignature)) {
    return null;
  }

  return payload;
}

function createGatePayload(profileId: string, expiresAt: number) {
  return `v1:${profileId}:${expiresAt}`;
}

function parseAttemptState(payload: string | null): AttemptState | null {
  if (!payload) return null;
  const [countRaw, windowStartedAtRaw, blockedUntilRaw] = payload.split(':');
  const count = Number(countRaw);
  const windowStartedAt = Number(windowStartedAtRaw);
  const blockedUntil = blockedUntilRaw ? Number(blockedUntilRaw) : null;

  if (!Number.isFinite(count) || !Number.isFinite(windowStartedAt)) {
    return null;
  }

  return {
    count,
    windowStartedAt,
    blockedUntil: blockedUntil && Number.isFinite(blockedUntil) ? blockedUntil : null,
  };
}

function serializeAttemptState(state: AttemptState) {
  return `${state.count}:${state.windowStartedAt}:${state.blockedUntil || ''}`;
}

export function validateAdminCreationPasswordValue(value: FormDataEntryValue | null, purpose = 'continuar') {
  const configuredPassword = getAdminCreationPassword();
  const providedPassword = String(value || '').trim();

  if (!configuredPassword) {
    return 'Configure ADMIN_CREATION_PASSWORD no servidor para liberar esta área administrativa.';
  }

  if (!providedPassword) {
    return `Informe a senha adicional de administrador para ${purpose}.`;
  }

  if (providedPassword !== configuredPassword) {
    return 'Senha adicional de administrador inválida.';
  }

  return null;
}

export async function isUserManagementGateUnlocked(profileId: string | null | undefined) {
  if (!profileId) return false;

  const cookieStore = await cookies();
  const payload = decodeSignedPayload(cookieStore.get(ADMIN_USERS_GATE_COOKIE)?.value);
  if (!payload) return false;

  const [version, cookieProfileId, expiresAtRaw] = payload.split(':');
  const expiresAt = Number(expiresAtRaw);

  if (version !== 'v1' || cookieProfileId !== profileId || !Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt > Date.now();
}

export async function unlockUserManagementGate(profileId: string) {
  const expiresAt = Date.now() + ADMIN_USERS_GATE_MAX_AGE * 1000;
  const token = encodeSignedPayload(createGatePayload(profileId, expiresAt));
  if (!token) return;

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_USERS_GATE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_USERS_GATE_MAX_AGE,
    path: '/cadastros/usuarios',
  });
}

export async function lockUserManagementGate() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_USERS_GATE_COOKIE);
}

export async function getUserManagementUnlockCooldown() {
  const cookieStore = await cookies();
  const payload = decodeSignedPayload(cookieStore.get(ADMIN_USERS_GATE_ATTEMPTS_COOKIE)?.value);
  const state = parseAttemptState(payload);
  if (!state || state.blockedUntil === null) return 0;
  if (Date.now() >= state.blockedUntil) return 0;
  return Math.ceil((state.blockedUntil - Date.now()) / 1000);
}

export async function registerUserManagementGateFailure() {
  const cookieStore = await cookies();
  const payload = decodeSignedPayload(cookieStore.get(ADMIN_USERS_GATE_ATTEMPTS_COOKIE)?.value);
  const currentState = parseAttemptState(payload);
  const now = Date.now();

  let nextState: AttemptState;

  if (!currentState || now - currentState.windowStartedAt > ADMIN_USERS_GATE_ATTEMPT_WINDOW * 1000) {
    nextState = {
      count: 1,
      windowStartedAt: now,
      blockedUntil: null,
    };
  } else {
    const nextCount = currentState.count + 1;
    nextState = {
      count: nextCount,
      windowStartedAt: currentState.windowStartedAt,
      blockedUntil: nextCount >= ADMIN_USERS_GATE_ATTEMPT_LIMIT ? now + ADMIN_USERS_GATE_LOCK_SECONDS * 1000 : null,
    };
  }

  const signed = encodeSignedPayload(serializeAttemptState(nextState));
  if (!signed) return;

  cookieStore.set({
    name: ADMIN_USERS_GATE_ATTEMPTS_COOKIE,
    value: signed,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_USERS_GATE_LOCK_SECONDS,
    path: '/cadastros/usuarios',
  });
}

export async function clearUserManagementGateFailures() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_USERS_GATE_ATTEMPTS_COOKIE);
}
