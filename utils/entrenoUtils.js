/* ───────── Constantes y Utilidades para Entreno ───────── */

export const EXTRA_ABBR = {
  Descendentes: 'DESC',
  'Mio Reps': 'MR',
  Parciales: 'PARC',
  'Rest-Pause': 'RP',
  Biserie: 'BS',
  Biseries: 'BS',
  bs: 'BS',
};

export const NOTE_VALUES = [
  { key: 'high', label: 'Alta', color: '#ef4444', emoji: '🔴' },
  { key: 'normal', label: 'Media', color: '#f97316', emoji: '🟠' },
  { key: 'low', label: 'Ok', color: '#22c55e', emoji: '🟢' },
  { key: 'custom', label: 'Nota', color: '#3b82f6', emoji: '🔵' },
];

export function getTrendIcon(curr, prev) {
  if (prev == null || curr == null || curr === '') return null;
  const c = Number(curr);
  const p = Number(prev);
  if (isNaN(c) || isNaN(p)) return null;
  if (c > p) return { name: 'arrow-up', color: '#3b82f6' };
  if (c < p) return { name: 'arrow-down', color: '#ef4444' };
  return { name: 'remove', color: '#6b7280' };
}

export const findPrevData = (prog, week, d, eId, sIdx, field) => {
  if (!prog) return null;
  for (let w = week - 1; w > 0; w--) {
    const key = `${w}|${d}|${eId}|${sIdx}`;
    const data = prog[key]?.[field];
    if (data) return data;
  }
  return null;
};
