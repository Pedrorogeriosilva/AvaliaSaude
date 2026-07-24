type SupabaseLikeError = {
  message?: string;
  code?: string;
  status?: number;
  details?: string | null;
  hint?: string | null;
  name?: string;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractMessage(error: unknown) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const item = error as SupabaseLikeError;
    return [item.message, item.details, item.hint, item.code, item.name].filter(Boolean).join(' ');
  }

  return String(error);
}

function extractCode(error: unknown) {
  if (error && typeof error === 'object') {
    return String((error as SupabaseLikeError).code || '');
  }
  return '';
}

function extractStatus(error: unknown) {
  if (error && typeof error === 'object') {
    return (error as SupabaseLikeError).status || null;
  }
  return null;
}

function includesAny(message: string, markers: string[]) {
  return markers.some((marker) => message.includes(marker));
}

function looksTechnical(message: string) {
  return includesAny(message, [
    'violates',
    'constraint',
    'duplicate key',
    'invalid input syntax',
    'invalid input value for enum',
    'new row',
    'foreign key',
    'row-level security',
    'permission denied',
    'jwt',
    'schema cache',
    'could not find',
    'does not exist',
    'null value',
    'postgres',
    'postgrest',
    'supabase',
    'auth',
    'pgrst',
    '23505',
    '23503',
    '23514',
    '23502',
    '22p02',
    '42501',
    '42p01',
    '42883',
    'sql',
    'relation',
    'column',
    'operator does not exist',
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'econnrefused',
    'etimedout',
  ]);
}

export function isAuthOrPermissionError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  const message = normalize(`${error.message || ''} ${error.details || ''} ${error.hint || ''} ${error.code || ''}`);
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.code === '42501' ||
    includesAny(message, [
      'jwt',
      'permission denied',
      'row-level security',
      'violates row-level security',
      'unauthorized',
      'not authorized',
      'access token',
      'invalid api key',
      'api key',
      'forbidden',
    ])
  );
}

export function getFriendlyErrorMessage(error: unknown, fallback = 'Não foi possível concluir a ação agora. Tente novamente.') {
  const rawMessage = extractMessage(error).trim();
  const message = normalize(rawMessage);
  const code = normalize(extractCode(error));
  const status = extractStatus(error);

  if (!rawMessage || rawMessage.length > 180 || /[<>]/.test(rawMessage)) return fallback;

  if (
    includesAny(message, ['patients_cpf_format', 'cpf_format']) ||
    (message.includes('cpf') && includesAny(message, ['check constraint', 'violates check constraint', '23514'])) ||
    (message.includes('cpf') && includesAny(message, ['invalid', 'invalido', 'formato']))
  ) {
    return 'CPF inválido. Informe exatamente 11 números ou deixe o campo em branco.';
  }

  if (code === '23505' || includesAny(message, ['duplicate key', 'already registered', 'already exists', 'user already registered', 'unique constraint', 'violates unique'])) {
    if (message.includes('cpf')) return 'Este CPF já está cadastrado no sistema.';
    if (includesAny(message, ['email', 'user', 'profiles_email', 'auth.users'])) return 'Este e-mail já está cadastrado no sistema.';
    if (message.includes('evaluation_professionals')) return 'Este profissional já foi adicionado nesta avaliação.';
    return 'Já existe um cadastro com essas informações.';
  }

  if (code === '23502' || includesAny(message, ['null value', 'not-null', 'not null'])) {
    return 'Preencha todos os campos obrigatórios antes de continuar.';
  }

  if (includesAny(message, ['min_length', 'minimum length', 'too short', 'string too short'])) {
    if (message.includes('full_name')) return 'Informe o nome completo com pelo menos 3 caracteres.';
    if (message.includes('address')) return 'Informe um endereço válido.';
    if (message.includes('position')) return 'Informe o cargo ou função do profissional.';
    return 'Um dos campos está muito curto. Revise as informações e tente novamente.';
  }

  if (code === '23503' || includesAny(message, ['foreign key', 'violates foreign key', 'still referenced'])) {
    if (message.includes('patient')) return 'Paciente não encontrado ou vinculado a outros dados. Atualize a página e tente novamente.';
    if (message.includes('health_unit')) return 'Unidade de saúde não encontrada ou vinculada a outros dados. Revise os vínculos antes de continuar.';
    if (message.includes('professional')) return 'Profissional não encontrado ou vinculado a avaliações. Revise os vínculos antes de continuar.';
    return 'Este registro está vinculado a outros dados do sistema. Revise os vínculos antes de excluir ou alterar.';
  }

  if (code === '22p02' || includesAny(message, ['invalid input syntax', 'invalid uuid', 'invalid input value for enum'])) {
    if (message.includes('uuid')) return 'Um dos registros selecionados é inválido. Atualize a página e tente novamente.';
    if (message.includes('enum')) return 'Uma das opções selecionadas é inválida. Atualize a página e tente novamente.';
    return 'Um dos campos foi preenchido em formato inválido. Revise as informações e tente novamente.';
  }

  if (code === '23514' || includesAny(message, ['violates check constraint', 'check constraint'])) {
    if (includesAny(message, ['score', 'nota', 'general_score', 'structure_score', 'wait_time_score', 'evaluation_professionals_score'])) {
      return 'Informe notas válidas entre 0 e 10.';
    }
    if (message.includes('attendance_date')) return 'A data do atendimento não pode ser futura.';
    if (message.includes('status')) return 'Status inválido. Selecione uma opção válida.';
    if (message.includes('resolution')) return 'Resolução inválida. Selecione uma opção válida.';
    if (message.includes('manifestation')) return 'Tipo de manifestação inválido. Selecione uma opção válida.';
    if (message.includes('type') || message.includes('health_unit_type')) return 'Tipo de unidade inválido. Selecione uma opção válida.';
    return 'Um dos campos foi preenchido em formato inválido. Revise as informações e tente novamente.';
  }

  if (includesAny(message, ['invalid date', 'date/time field value out of range'])) {
    return 'Informe uma data válida.';
  }

  if (includesAny(message, ['invalid number', 'nan', 'numeric field overflow', 'out of range'])) {
    return 'Informe valores numéricos válidos.';
  }

  if (includesAny(message, ['invalid login credentials', 'invalid credentials'])) {
    return 'E-mail ou senha inválidos.';
  }

  if (includesAny(message, ['email not confirmed', 'confirm your email'])) {
    return 'Confirme o e-mail deste usuário antes de acessar.';
  }

  if (includesAny(message, ['invalid email', 'unable to validate email', 'email address is invalid', 'signup requires a valid email'])) {
    return 'Informe um e-mail válido.';
  }

  if (message.includes('password')) {
    if (includesAny(message, ['at least', 'weak', 'short', 'should be', 'minimum', 'min'])) {
      return 'Informe uma senha mais forte, com pelo menos 8 caracteres.';
    }

    if (includesAny(message, ['invalid', 'incorrect'])) {
      return 'Senha inválida. Verifique e tente novamente.';
    }
  }

  if (includesAny(message, ['rate limit', 'too many requests', 'too many request', 'email rate limit'])) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  if (includesAny(message, ['user not found', 'not found']) && includesAny(message, ['auth', 'user'])) {
    return 'Usuário não encontrado. Atualize a página e tente novamente.';
  }

  if (
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    includesAny(message, [
      'permission denied',
      'row-level security',
      'violates row-level security',
      'jwt',
      'unauthorized',
      'not authorized',
      'forbidden',
      'access token',
      'invalid api key',
      'api key',
      'not authenticated',
    ])
  ) {
    return 'Seu usuário não tem permissão para realizar esta ação. Entre novamente ou confirme o perfil de acesso.';
  }

  if (includesAny(message, ['supabase_service_role_key', 'service role', 'service_role', 'configuracao administrativa incompleta'])) {
    return 'A chave de serviço do Supabase não está configurada no servidor. Verifique as variáveis de ambiente.';
  }

  if (includesAny(message, ['next_public_supabase_url', 'next_public_supabase_anon_key', 'configuracao do supabase incompleta'])) {
    return 'As variáveis do Supabase não estão configuradas corretamente no servidor.';
  }

  if ((code === '42p01' || includesAny(message, ['could not find the table', 'relation'])) && message.includes('does not exist')) {
    return 'As tabelas do Supabase ainda não foram configuradas corretamente.';
  }

  if (code === '42703' || (includesAny(message, ['column']) && message.includes('does not exist'))) {
    return 'A estrutura do banco está desatualizada. Revise o schema no Supabase.';
  }

  if (code === '42883' || (includesAny(message, ['could not find the function', 'function']) && message.includes('does not exist'))) {
    return 'A estrutura do banco está incompleta. Revise as funções do schema no Supabase.';
  }

  if (includesAny(message, ['schema cache', 'pgrst200', 'pgrst204'])) {
    return 'A estrutura do banco foi alterada recentemente. Atualize o schema cache ou aguarde alguns instantes.';
  }

  if (includesAny(message, ['pgrst116', 'json object requested', 'multiple or no rows'])) {
    return 'Registro não encontrado. Atualize a página e tente novamente.';
  }

  if (includesAny(message, ['failed to fetch', 'fetch failed', 'networkerror', 'network error', 'econnrefused', 'etimedout', 'timeout', 'aborted'])) {
    return 'Não foi possível conectar ao servidor agora. Verifique a conexão e tente novamente.';
  }

  if (looksTechnical(message)) {
    return fallback;
  }

  return fallback;
}

export function getFriendlySupabaseError(error: SupabaseLikeError | null | undefined, fallback = 'Não foi possível carregar os dados agora.') {
  if (!error) return fallback;

  if (isAuthOrPermissionError(error)) {
    return 'Sessão sem permissão para acessar estes dados. Entre novamente e confirme se o usuário está ativo com perfil adequado.';
  }

  return getFriendlyErrorMessage(error, fallback);
}
