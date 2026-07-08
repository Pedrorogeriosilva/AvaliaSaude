import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

const ADMIN_USERS_GATE_COOKIE = 'avalia_admin_users_gate';
const ADMIN_USERS_GATE_MAX_AGE = 20 * 60;

export function getAdminCreationPassword() {
  return String(process.env.ADMIN_CREATION_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
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

function createGateToken(profileId: string) {
  const secret = getAdminCreationPassword();
  if (!secret || !profileId) return null;

  return createHmac('sha256', secret)
    .update(`avalia-saude:user-management:${profileId}`)
    .digest('hex');
}

export async function isUserManagementGateUnlocked(profileId: string | null | undefined) {
  if (!profileId) return false;

  const expectedToken = createGateToken(profileId);
  if (!expectedToken) return false;

  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_USERS_GATE_COOKIE)?.value === expectedToken;
}

export async function unlockUserManagementGate(profileId: string) {
  const token = createGateToken(profileId);
  if (!token) return;

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_USERS_GATE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_USERS_GATE_MAX_AGE,
    path: '/cadastros/usuarios',
  });
}
