import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { clearFailures, peekRateLimit, registerFailure, type RateLimitOptions } from '@/lib/rate-limit';

const ADMIN_USERS_GATE_COOKIE = 'avalia_admin_users_gate';
const ADMIN_USERS_GATE_ATTEMPTS_COOKIE = 'avalia_admin_users_gate_attempts';
const ADMIN_USERS_GATE_MAX_AGE = 20 * 60;
const ADMIN_USERS_GATE_ATTEMPT_WINDOW = 10 * 60;
const ADMIN_USERS_GATE_ATTEMPT_LIMIT = 5;
const ADMIN_USERS_GATE_LOCK_SECONDS = 10 * 60;

const GATE_RATE_LIMIT: RateLimitOptions = {
  limit: ADMIN_USERS_GATE_ATTEMPT_LIMIT,
  windowSeconds: ADMIN_USERS_GATE_ATTEMPT_WINDOW,
  blockSeconds: ADMIN_USERS_GATE_LOCK_SECONDS,
};

function gateRateLimitKey(profileId: string) {
  return `admin-gate:${profileId}`;
}

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

/**
 * Compara segredos em tempo constante. O hash intermediário garante buffers do
 * mesmo tamanho, então nem o conteúdo nem o comprimento da senha vazam pelo
 * tempo de resposta.
 */
function safeEqualsSecret(left: string, right: string) {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
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

  if (!safeEqualsSecret(providedPassword, configuredPassword)) {
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

/**
 * O bloqueio é avaliado em duas camadas e vale a mais restritiva:
 *
 * 1. Contador em memória do servidor, que o visitante não consegue apagar.
 * 2. Cookie assinado, que sobrevive a cold start e troca de instância.
 *
 * Sozinho o cookie não protegia nada: bastava apagá-lo para zerar o bloqueio.
 */
export async function getUserManagementUnlockCooldown(profileId?: string | null) {
  const serverCooldown = profileId ? peekRateLimit(gateRateLimitKey(profileId)).retryAfterSeconds : 0;

  const cookieStore = await cookies();
  const payload = decodeSignedPayload(cookieStore.get(ADMIN_USERS_GATE_ATTEMPTS_COOKIE)?.value);
  const state = parseAttemptState(payload);
  const cookieCooldown =
    !state || state.blockedUntil === null || Date.now() >= state.blockedUntil
      ? 0
      : Math.ceil((state.blockedUntil - Date.now()) / 1000);

  return Math.max(serverCooldown, cookieCooldown);
}

export async function registerUserManagementGateFailure(profileId?: string | null) {
  if (profileId) {
    registerFailure(gateRateLimitKey(profileId), GATE_RATE_LIMIT);
  }

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

export async function clearUserManagementGateFailures(profileId?: string | null) {
  if (profileId) {
    clearFailures(gateRateLimitKey(profileId));
  }

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_USERS_GATE_ATTEMPTS_COOKIE);
}
