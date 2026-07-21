import 'server-only';

/**
 * Limitador de tentativas em memória do servidor.
 *
 * Importante: o estado vive no processo. Em ambientes com várias instâncias
 * (Vercel, por exemplo) cada instância mantém a própria contagem e o estado é
 * perdido a cada cold start. Ainda assim é muito melhor do que confiar em um
 * cookie, porque o visitante não consegue apagar ou forjar este contador.
 * Para um bloqueio global e persistente, trocar o Map por Redis/Upstash.
 */

type Bucket = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 5000;

function sweep(now: number, windowMs: number) {
  if (buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    const isExpired = now - bucket.windowStartedAt > windowMs && (!bucket.blockedUntil || now >= bucket.blockedUntil);
    if (isExpired) buckets.delete(key);
  }
}

export type RateLimitOptions = {
  /** Quantidade de tentativas permitidas dentro da janela. */
  limit: number;
  /** Duração da janela de contagem, em segundos. */
  windowSeconds: number;
  /** Duração do bloqueio depois de estourar o limite, em segundos. */
  blockSeconds: number;
};

export type RateLimitResult = {
  blocked: boolean;
  /** Segundos restantes de bloqueio. Zero quando não está bloqueado. */
  retryAfterSeconds: number;
};

/** Consulta o bloqueio sem registrar uma nova tentativa. */
export function peekRateLimit(key: string): RateLimitResult {
  const bucket = buckets.get(key);
  const now = Date.now();

  if (!bucket?.blockedUntil || now >= bucket.blockedUntil) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
  };
}

/** Registra uma tentativa falha e devolve o estado de bloqueio resultante. */
export function registerFailure(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  sweep(now, windowMs);

  const current = buckets.get(key);
  const isNewWindow = !current || now - current.windowStartedAt > windowMs;

  const bucket: Bucket = isNewWindow
    ? { count: 1, windowStartedAt: now, blockedUntil: null }
    : {
        count: current.count + 1,
        windowStartedAt: current.windowStartedAt,
        blockedUntil: current.blockedUntil,
      };

  if (bucket.count >= options.limit) {
    bucket.blockedUntil = now + options.blockSeconds * 1000;
  }

  buckets.set(key, bucket);

  return peekRateLimit(key);
}

/** Zera o contador após uma tentativa bem-sucedida. */
export function clearFailures(key: string) {
  buckets.delete(key);
}
