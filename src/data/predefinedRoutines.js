// src/data/predefinedRoutines.js
// ⚠️ IMPORTANTE: Este archivo contiene SOLO rutinas GRATUITAS

// --- 1. DATOS DE EJERCICIOS (Arrays [dia][ejercicio] por separado) ---

// Datos para la Rutina Full-Body Genérica (3 días)
export const GENERIC_FULLBODY_DATA = [
  // Día 1 (Índice 0): Piernas FUERTE (6–8, multiarticular) · Tirón INTERMEDIO (10–12) · Empuje LIVIANO (10–15, máquinas/poleas)
  [
    // PIERNA – FUERTE
    {
      id: 'gen_fb_1_1',
      musculo: 'PIERNAS',
      nombre: 'Sentadilla Libre',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_1_2',
      musculo: 'PIERNAS',
      nombre: 'Peso Muerto Rumano',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },

    // TIRÓN – INTERMEDIO
    {
      id: 'gen_fb_1_3',
      musculo: 'ESPALDA',
      nombre: 'Jalón al Pecho',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_1_4',
      musculo: 'ESPALDA',
      nombre: 'Remo en T (con apoyo)',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },

    // EMPUJE – LIVIANO
    {
      id: 'gen_fb_1_5',
      musculo: 'PECTORAL',
      nombre: 'Press Banca Maquina',
      series: [
        { repMin: '10', repMax: '15', extra: 'Ninguno' },
        { repMin: '10', repMax: '15', extra: 'Ninguno' },
        { repMin: '10', repMax: '15', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_1_6',
      musculo: 'HOMBRO',
      nombre: 'Elevaciones Laterales Polea',
      series: [
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
      ],
    },
  ],

  // Día 2 (Índice 1): Tirón FUERTE (6–8, multiarticular) · Empuje INTERMEDIO (10–12) · Piernas LIVIANO (10–15, máquinas)
  [
    // TIRÓN – FUERTE
    {
      id: 'gen_fb_2_1',
      musculo: 'ESPALDA',
      nombre: 'SLDL',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_2_2',
      musculo: 'ESPALDA',
      nombre: 'Dominadas',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },

    // EMPUJE – INTERMEDIO
    {
      id: 'gen_fb_2_3',
      musculo: 'PECTORAL',
      nombre: 'Press Banca Plano/Poco Inclinado',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_2_4',
      musculo: 'HOMBRO',
      nombre: 'Press Militar Mancuernas',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },

    // PIERNAS – LIVIANO
    {
      id: 'gen_fb_2_5',
      musculo: 'PIERNAS',
      nombre: 'Prensa',
      series: [
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_2_6',
      musculo: 'ISQUIOTIBIALES',
      nombre: 'Femoral Tumbado',
      series: [
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
      ],
    },
  ],

  // Día 3 (Índice 2): Empuje FUERTE (6–8) · Piernas INTERMEDIO (10–12) · Tirón LIVIANO (10–15)
  [
    // EMPUJE – FUERTE
    {
      id: 'gen_fb_3_1',
      musculo: 'PECTORAL',
      nombre: 'Press Banca con Barra',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_3_2',
      musculo: 'HOMBRO',
      nombre: 'Press Militar',
      series: [
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
        { repMin: '6', repMax: '8', extra: 'Ninguno' },
      ],
    },

    // PIERNAS – INTERMEDIO
    {
      id: 'gen_fb_3_3',
      musculo: 'PIERNAS',
      nombre: 'Sentadilla Bulgara Mancuernas (Cuád)',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_3_4',
      musculo: 'GLÚTEOS',
      nombre: 'Hip Thrust',
      series: [
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
        { repMin: '10', repMax: '12', extra: 'Ninguno' },
      ],
    },

    // TIRÓN – LIVIANO
    {
      id: 'gen_fb_3_5',
      musculo: 'ESPALDA',
      nombre: 'Remo en Multipower',
      series: [
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
      ],
    },
    {
      id: 'gen_fb_3_6',
      musculo: 'POSTERIOR/HOMBRO-ESPALDA',
      nombre: 'Face Pulls',
      series: [
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
        { repMin: '12', repMax: '15', extra: 'Ninguno' },
      ],
    },
  ],
];

// Datos para la Rutina German Martinez 4 Días (COMPLETA)
const RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA = [
  // --- Día 1 (Índice 0): Empujes + Cuádriceps ---
  [
    { id: 'gm_1_1', musculo: 'DELTOIDES LATERAL', nombre: 'Elevaciones Laterales Polea', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_2', musculo: 'DELTOIDES ANTERIOR', nombre: 'Press Militar Mancuernas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'gm_1_3', musculo: 'PECTORAL', nombre: 'Press Inclinado Mancuernas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_4', musculo: 'PECTORAL', nombre: 'Press Banca Plano/Poco Inclinado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_5', musculo: 'TRÍCEPS', nombre: 'Extensión codo barra (Polea)', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_6', musculo: 'TRÍCEPS', nombre: 'Press Francés', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_7', musculo: 'CUÁDRICEPS', nombre: 'Extensión Rodilla', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_1_8', musculo: 'ABDOMEN', nombre: 'Crunch en Polea', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // --- Día 2 (Índice 1): Tracciones + Femoral ---
  [
    { id: 'gm_2_1', musculo: 'GEMELO', nombre: 'Gemelo en Prensa', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_2_2', musculo: 'ISQUIOS', nombre: 'Femoral Tumbado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_2_3', musculo: 'DORSALES', nombre: 'Jalón Agarre Neutro', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_2_4', musculo: 'ESPALDA ALTA/MEDIA', nombre: 'Remo en T (con apoyo)', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_2_5', musculo: 'DORSALES', nombre: 'Jalón al Pecho', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'gm_2_6', musculo: 'DELTOIDES POSTERIOR', nombre: 'Posterior en Máquina', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_2_7', musculo: 'BÍCEPS', nombre: 'Curl Sentado con Mancuernas', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'gm_2_8', musculo: 'BÍCEPS', nombre: 'Curl con Barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
  ],
  // --- Día 3 (Índice 2): Pierna ---
  [
    { id: 'gm_3_1', musculo: 'GLUTEO-FEMORAL', nombre: 'Peso Muerto Rumano', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_3_2', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla Libre', series: [ { repMin: '4', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'gm_3_3', musculo: 'CUÁDRICEPS', nombre: 'Prensa', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_3_4', musculo: 'ISQUIOS', nombre: 'Femoral Sentado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_3_5', musculo: 'CUÁDRICEPS', nombre: 'Extensión Rodilla', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_3_6', musculo: 'ADUCTORES', nombre: 'Aductor Máquina', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_3_7', musculo: 'ABDOMEN', nombre: 'Encogimientos en Máquina', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // --- Día 4 (Índice 3): Empujes - Tracciones ---
  [
    { id: 'gm_4_1', musculo: 'DELTOIDES LATERAL', nombre: 'Elevación Lateral Mancuerna', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_4_2', musculo: 'PECTORAL', nombre: 'Press Inclinado Mancuernas', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'gm_4_3', musculo: 'ESPALDA ALTA/MEDIA', nombre: 'Remo en T (con apoyo)', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_4_4', musculo: 'DORSALES', nombre: 'Remo T de Pie', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'gm_4_5', musculo: 'DELTOIDES POSTERIOR', nombre: 'Posterior en Polea Unilateral', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_4_6', musculo: 'TRÍCEPS', nombre: 'Extensión Codo Cuerda', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'gm_4_7', musculo: 'BÍCEPS', nombre: 'Curl con Barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
];

// --- 2. ARRAY PRINCIPAL DE RUTINAS PREDEFINIDAS (GRATUITAS) ---
export const predefinedRoutines = [
  // --- Objeto Rutina 1: Full-Body Genérica ---
  {
    // Metadatos (para mostrar en la lista 'rutinas')
    id: 'routine_generic_fullbody_001',
    nombre: 'Rutina Full-Body Principiantes',
    dias: 3, // Debe coincidir con GENERIC_FULLBODY_DATA.length
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Full-Body',
    enfoque: 'General',
    nivel: 'Principiante',
    // Datos completos (para guardar en 'routine_...')
    diasArr: GENERIC_FULLBODY_DATA
  },

  // --- Objeto Rutina 2: German Martinez ---
  {
    // Metadatos
    id: 'RUTINA_GERMAN_MARTINEZ_4_DIAS',
    nombre: 'Rutina 4 Días - Intermedia',
    dias: 4, // Debe coincidir con RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA.length
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Push/Pull/Legs/Push-Pull',
    enfoque: 'Hipertrofia',
    sexo: 'Ambos',
    nivel: 'Intermedio',
    // Datos completos
    diasArr: RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA
  },
];

// Exportar IDs si los usas en otro lugar
export const GENERIC_ID = predefinedRoutines[0].id;
export const GERMAN_MARTINEZ_ID = predefinedRoutines[1].id;