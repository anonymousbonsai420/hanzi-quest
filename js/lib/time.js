// Tempo: chaves de dia ('AAAA-MM-DD'), diferença e soma de dias, datas relativas e espera.

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
export const addDays = (key, n) => {
  const d = new Date(key + 'T12:00');
  d.setDate(d.getDate() + n);
  return todayKey(d);
};

export function fmtRelDays(ts) {
  const d = Math.round((ts - Date.now()) / 864e5);
  if (ts <= Date.now()) return 'agora';
  if (d <= 0) return 'hoje';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}

/** Data curta em pt-BR (ex.: '14 de nov.'). */
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '—');
/** Tempo decorrido desde `ts` (ex.: 'há 5 min'). */
export const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
