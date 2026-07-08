type SupabaseLikeError = {
  message?: string;
  code?: string;
  status?: number;
  details?: string | null;
  hint?: string | null;
};

export function isAuthOrPermissionError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.code === '42501' ||
    message.includes('jwt') ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('violates row-level security') ||
    message.includes('unauthorized')
  );
}

export function getFriendlySupabaseError(error: SupabaseLikeError | null | undefined, fallback = 'Não foi possível carregar os dados agora.') {
  if (!error) return fallback;

  if (isAuthOrPermissionError(error)) {
    return 'Sessão sem permissão para acessar estes dados. Entre novamente e confirme se o usuário está ativo com perfil admin ou operador.';
  }

  const message = error.message || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('could not find the table')) {
    return 'As tabelas do Supabase ainda não foram configuradas. Execute o arquivo database/schema.sql no SQL Editor.';
  }

  if (lowerMessage.includes('could not find the function') || lowerMessage.includes('does not exist')) {
    return 'A estrutura do banco está incompleta. Execute novamente o schema atualizado no Supabase.';
  }

  return fallback;
}
