export async function measureAsync<T>(label: string, task: () => Promise<T>) {
  const shouldLog = process.env.NODE_ENV === 'development' && process.env.ENABLE_PERF_LOGS === '1';

  if (!shouldLog) {
    return task();
  }

  const startedAt = Date.now();

  try {
    return await task();
  } finally {
    const duration = Date.now() - startedAt;
    console.info(`[perf] ${label}: ${duration}ms`);
  }
}
