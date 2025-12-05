// src/lib/syncRoutines.ts
// Objetivo: sincronizar rutinas del servidor y **solo** purgar las de servidor (ids `srv_*`).
// No tocamos rutinas locales gratuitas (predefinidas/csv/custom) ni progreso/LOG.

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export type SyncReport = {
  added: number;
  updated: number;
  removed: number;     // solo cuenta removidas de servidor (srv_*)
  total: number;       // total servidor (srv_*)
  serverIds: string[]; // ids locales srv_* existentes tras sync
};

const LIST_KEY = 'rutinas';
const ACTIVE_ID_KEY = 'active_routine';
const ACTIVE_NAME_KEY = 'active_routine_name';

// ID local estable para rutinas del servidor
const asServerId = (raw: string) => `srv_${raw}`;
// Detecta si una rutina es de servidor (Mongo)
const isServerId = (id: string | null | undefined) => !!id && id.startsWith('srv_');

// Extrae array de días desde distintas formas
function extractDiasArr(r: any): any[] {
  if (Array.isArray(r?.diasArr)) return r.diasArr;

  // Estructura { dia1, dia2, ... }
  if (r && typeof r === 'object') {
    const keys = Object.keys(r)
      .filter((k) => /^dia\d+$/.test(k))
      .sort((a, b) => Number(a.replace('dia', '')) - Number(b.replace('dia', '')));
    if (keys.length) return keys.map((k) => r[k]);
  }
  return [];
}

// Normaliza base y concatena path
function buildUrl(apiBase: string, maybePath: string) {
  const base = apiBase.replace(/\/+$/, '');
  const path = `/${maybePath.replace(/^\/+/, '')}`;
  return `${base}${path}`;
}

// Intenta varias rutas hasta obtener 2xx
async function tryFetchRoutines(apiBase: string, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const candidates = [
    'api/routines/me',
    'api/routines/my',
    'routines/me',
    'routines/my',
    'api/users/me/routines',
    'users/me/routines',
  ];

  for (const path of candidates) {
    try {
      const url = buildUrl(apiBase, path);
      const res = await axios.get(url, { headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) return res.data;
      if (__DEV__) console.log(`[sync] ${url} -> ${res.status}`);
    } catch (e) {
      if (__DEV__) console.log(`[sync] fallo ${path}`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/**
 * Sincroniza rutinas del usuario desde el backend:
 * - Lee lista local actual y **conserva** todas las NO servidor (id !startsWith('srv_')).
 * - Sustituye/actualiza SOLO las de servidor con lo que venga del backend.
 * - PURGA de AsyncStorage únicamente `routine_{srv_*}` y `last_session_{srv_*}` que ya no estén en servidor.
 * - Mantiene progreso/logs intactos.
 */
export async function syncRoutinesFromServer(apiBase: string, token: string): Promise<SyncReport> {
  // 0) Leer lista local actual para conservar las que NO son servidor
  const currJson = await AsyncStorage.getItem(LIST_KEY);
  let localList: any[] = [];
  try {
    const parsed = currJson ? JSON.parse(currJson) : [];
    localList = Array.isArray(parsed) ? parsed.filter((r) => r && r.id) : [];
  } catch {
    localList = [];
  }
  const localFree = localList.filter((r) => !isServerId(r.id)); // se conservan

  // 1) Traer servidor
  const data = await tryFetchRoutines(apiBase, token);
  if (!data) {
    if (__DEV__) console.warn('[sync] No se pudo obtener rutinas del servidor; se mantiene lista local tal cual');
    // No tocamos nada si el server falla
    return { added: 0, updated: 0, removed: 0, total: 0, serverIds: [] };
  }

  // 2) Aceptar varias formas de respuesta
  const routines: any[] =
    Array.isArray(data?.routines) ? data.routines
    : Array.isArray(data?.list)   ? data.list
    : Array.isArray(data)         ? data
    : [];

  // 3) Construir lista servidor normalizada (ids srv_*)
  const serverList = routines.map((r: any) => {
    const sidRaw = String(r._id || r.id || r.uuid || '');
    const sid = asServerId(sidRaw);
    const diasArr = extractDiasArr(r);
    const dias = Number(r.dias || (Array.isArray(diasArr) ? diasArr.length : 1)) || 1;
    return {
      id: sid,
      nombre: r.nombre || r.name || 'Rutina',
      dias,
      fecha: new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }),
      server: true,
    };
  });
  const serverIds = serverList.map((x) => x.id);
  const serverSet = new Set(serverIds);

  // 4) Guardar payloads de servidor (no tocamos locales)
  let added = 0;
  let updated = 0;
  for (const r of routines) {
    const sidRaw = String(r._id || r.id || r.uuid || '');
    if (!sidRaw) continue;
    const id = asServerId(sidRaw);
    const key = `routine_${id}`;

    const diasArr = extractDiasArr(r);
    const payload = Array.isArray(diasArr) && diasArr.length ? diasArr : r?.payload || r; // tolerante

    const newVal = JSON.stringify(payload);
    const oldVal = await AsyncStorage.getItem(key);
    if (oldVal === null) added += 1;
    else if (oldVal !== newVal) updated += 1;

    await AsyncStorage.setItem(key, newVal);
  }

  // 5) PURGA: SOLO rutinas de servidor (srv_*) que ya no estén en servidor
  const allKeys = await AsyncStorage.getAllKeys();
  const routineKeys = allKeys.filter((k) => k.startsWith('routine_srv_'));
  const localSrvIds = routineKeys.map((k) => k.replace('routine_', '')); // ids srv_*
  const staleSrvIds = localSrvIds.filter((id) => !serverSet.has(id));

  for (const id of staleSrvIds) {
    await AsyncStorage.multiRemove([`routine_${id}`, `last_session_${id}`]);
  }

  // 6) Lista final = [localesGratis] + [servidor]
  const finalList = [...localFree, ...serverList];
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(finalList));

  // 7) Si la activa es de servidor y ya no existe → limpiar
  const activeId = await AsyncStorage.getItem(ACTIVE_ID_KEY);
  if (activeId && isServerId(activeId) && !serverSet.has(activeId)) {
    await AsyncStorage.multiRemove([ACTIVE_ID_KEY, ACTIVE_NAME_KEY]);
  }

  // 8) Marca de sync
  await AsyncStorage.setItem('last_sync_ts', new Date().toISOString());

  return { added, updated, removed: staleSrvIds.length, total: serverIds.length, serverIds };
}
