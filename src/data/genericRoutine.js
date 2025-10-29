// src/data/predefinedRoutines.js

// --- 1. DATOS DE EJERCICIOS (Arrays [dia][ejercicio] por separado) ---

// Datos para la Rutina Full-Body Genérica (3 días)
// Asegúrate de completar los ejercicios de los días 2 y 3 aquí
const GENERIC_FULLBODY_DATA = [
  // Día 1 (Índice 0)
  [
    { id: 'gen_fb_1_1', musculo: 'PECTORAL', nombre: 'Press Banca con Barra', series: [ { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' }, ], },
    { id: 'gen_fb_1_2', musculo: 'ESPALDA', nombre: 'Remo con Barra', series: [ { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' } ], },
    { id: 'gen_fb_1_3', musculo: 'CUADRICEPS', nombre: 'Sentadilla', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ], },
    // ... añade más ejercicios día 1 ...
  ],
  // Día 2 (Índice 1) - ¡COMPLETAR!
  [
    { id: 'gen_fb_2_1', musculo: 'DELTOIDES', nombre: 'Press Militar Mancuernas', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, /*...*/ ] },
    // ...
  ],
  // Día 3 (Índice 2) - ¡COMPLETAR!
  [
     { id: 'gen_fb_3_1', musculo: 'BICEPS', nombre: 'Curl Barra', series: [ { repMin: '10', repMax: '12', extra: 'Ninguno' }, /*...*/ ] },
     // ...
  ],
];

// Datos para la Rutina German Martinez 4 Días (COMPLETA)
const RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA = [
  // --- Día 1 (Índice 0): Empujes + Cuádriceps ---
  [
    { id: 'gm_1_1', musculo: 'DELTOIDES LATERAL', nombre: 'Elevaciones laterales polea', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_2', musculo: 'DELTOIDES ANTERIOR', nombre: 'Press militar mancuernas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, ], },
    { id: 'gm_1_3', musculo: 'PECTORAL', nombre: 'Press inclinado mancuernas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_4', musculo: 'PECTORAL', nombre: 'Press banca plano', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_5', musculo: 'TRÍCEPS', nombre: 'Extensión codo barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_6', musculo: 'TRÍCEPS', nombre: 'Press francés', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_7', musculo: 'CUÁDRICEPS', nombre: 'Extensión rodilla', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_1_8', musculo: 'ABDOMEN', nombre: 'Crunch en polea', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
  ],
  // --- Día 2 (Índice 1): Tracciones + Femoral ---
  [
    { id: 'gm_2_1', musculo: 'GEMELO', nombre: 'Gemelo', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_2_2', musculo: 'ISQUIOS', nombre: 'Femoral tumbado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_2_3', musculo: 'DORSALES', nombre: 'Jalón agarre neutro', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_2_4', musculo: 'ESPALDA ALTA/MEDIA', nombre: 'Remo en T', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_2_5', musculo: 'DORSALES', nombre: 'Jalón abierto', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, ], },
    { id: 'gm_2_6', musculo: 'DELTOIDES POSTERIOR', nombre: 'Posterior en máquina o pájaros', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_2_7', musculo: 'BÍCEPS', nombre: 'Curl bíceps mancuerna', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, ], },
    { id: 'gm_2_8', musculo: 'BÍCEPS', nombre: 'Curl Arnold', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, ], },
  ],
  // --- Día 3 (Índice 2): Pierna ---
  [
    { id: 'gm_3_1', musculo: 'GLUTEO-FEMORAL', nombre: 'Peso muerto rumano', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_3_2', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla', series: [ { repMin: '4', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, ], },
    { id: 'gm_3_3', musculo: 'CUÁDRICEPS', nombre: 'Prensa', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_3_4', musculo: 'ISQUIOS', nombre: 'Femoral sentado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_3_5', musculo: 'CUÁDRICEPS', nombre: 'Extensión rodilla', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_3_6', musculo: 'ADUCTORES', nombre: 'Aductor máquina', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_3_7', musculo: 'ABDOMEN', nombre: 'Encogimientos en máquina', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
  ],
  // --- Día 4 (Índice 3): Empujes - Tracciones ---
  [
    { id: 'gm_4_1', musculo: 'DELTOIDES LATERAL', nombre: 'Elevación lateral mancuerna', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_4_2', musculo: 'PECTORAL', nombre: 'Press inclinado mancuernas', series: [ { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '5', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '10', extra: 'Ninguno' }, ], },
    { id: 'gm_4_3', musculo: 'ESPALDA ALTA/MEDIA', nombre: 'Remo máquina sentado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_4_4', musculo: 'DORSALES', nombre: 'Remo Gironda', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, ], },
    { id: 'gm_4_5', musculo: 'DELTOIDES POSTERIOR', nombre: 'Posterior en polea unilateral', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_4_6', musculo: 'TRÍCEPS', nombre: 'Extensión tríceps polea', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
    { id: 'gm_4_7', musculo: 'BÍCEPS', nombre: 'Curl bíceps con barra Z', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, ], },
  ],
];

// --- 2. ARRAY PRINCIPAL DE RUTINAS PREDEFINIDAS ---
export const PREDEFINED_ROUTINES = [
  // --- Objeto Rutina 1: Full-Body Genérica ---
  {
    // Metadatos (para mostrar en la lista 'rutinas')
    id: 'routine_generic_fullbody_001',
    nombre: 'Rutina Full-Body Genérica',
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
    nombre: 'Rutina 4 Días - German Martinez',
    dias: 4, // Debe coincidir con RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA.length
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Push/Pull/Legs/Push-Pull',
    enfoque: 'Hipertrofia',
    sexo: 'Ambos',
    nivel: 'Intermedio',
    // Datos completos
    diasArr: RUTINA_GERMAN_MARTINEZ_4_DIAS_DATA
  },

  // --- Puedes añadir más rutinas aquí ---
  // {
  //   id: 'otra_rutina_003',
  //   nombre: 'Rutina Torso-Pierna 4 Días',
  //   dias: 4,
  //   fecha: '...',
  //   division: 'Torso/Pierna',
  //   diasArr: OTROS_DATOS_RUTINA_3 // Necesitarías definir esta constante arriba
  // },
];

// Opcional: Exportar IDs si los usas en otro lugar
export const GENERIC_ID = PREDEFINED_ROUTINES[0].id;
export const GERMAN_MARTINEZ_ID = PREDEFINED_ROUTINES[1].id;

