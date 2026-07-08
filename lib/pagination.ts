export const DEFAULT_PAGE_SIZE = 20;

export function getPage(value?: string) {
  const page = Number(value || '1');
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function getRange(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}