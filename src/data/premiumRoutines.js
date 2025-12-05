// src/data/premiumRoutines.js
// ⚠️ IMPORTANTE: Este archivo contiene SOLO rutinas PREMIUM

// --- DATOS DE EJERCICIOS PREMIUM ---

// Rutina Premium 1: Torso-Pierna Avanzada (4 días)
const TORSO_PIERNA_AVANZADA_DATA = [
  // Día 1 - Torso Superior (Empuje dominante)
  [
    { id: 'prem_tp_1_1', musculo: 'PECTORAL', nombre: 'Press Banca Inclinado con Barra', series: [ { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'prem_tp_1_2', musculo: 'PECTORAL', nombre: 'Press Plano con Mancuernas', series: [ { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' }, { repMin: '10', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_1_3', musculo: 'HOMBRO', nombre: 'Press Arnold', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_1_4', musculo: 'HOMBRO', nombre: 'Elevaciones Laterales con Disco', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_1_5', musculo: 'TRÍCEPS', nombre: 'Fondos en Paralelas', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 2 - Pierna Completa
  [
    { id: 'prem_tp_2_1', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla Frontal', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_2_2', musculo: 'GLÚTEOS', nombre: 'Hip Thrust con Barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_2_3', musculo: 'ISQUIOS', nombre: 'Peso Muerto Piernas Rígidas', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_2_4', musculo: 'CUÁDRICEPS', nombre: 'Prensa a Una Pierna', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_2_5', musculo: 'GEMELOS', nombre: 'Gemelo de Pie con Barra', series: [ { repMin: '12', repMax: '20', extra: 'Ninguno' }, { repMin: '12', repMax: '20', extra: 'Ninguno' } ] },
  ],
  // Día 3 - Torso Superior (Tirón dominante)
  [
    { id: 'prem_tp_3_1', musculo: 'ESPALDA', nombre: 'Dominadas Lastradas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_3_2', musculo: 'ESPALDA', nombre: 'Remo Pendlay', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_tp_3_3', musculo: 'ESPALDA', nombre: 'Pullover con Mancuerna', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_3_4', musculo: 'HOMBRO POSTERIOR', nombre: 'Face Pulls con Cuerda', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_tp_3_5', musculo: 'BÍCEPS', nombre: 'Curl Martillo Alterno', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 4 - Pierna + Core
  [
    { id: 'prem_tp_4_1', musculo: 'CUÁDRICEPS', nombre: 'Zancadas Caminando con Barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_4_2', musculo: 'ISQUIOS', nombre: 'Good Morning', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_4_3', musculo: 'GLÚTEOS', nombre: 'Patada de Glúteo en Polea', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_4_4', musculo: 'ABDOMEN', nombre: 'Ab Wheel Rollout', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_tp_4_5', musculo: 'OBLICUOS', nombre: 'Pallof Press', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
  ],
];

// Rutina Premium 2: Push/Pull/Legs Avanzado (6 días)
const PPL_AVANZADO_DATA = [
  // Día 1 - Push 1
  [
    { id: 'prem_ppl_1_1', musculo: 'PECTORAL', nombre: 'Press Banca Plano Pausa', series: [ { repMin: '4', repMax: '6', extra: 'Ninguno' }, { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_1_2', musculo: 'HOMBRO', nombre: 'Press Militar de Pie', series: [ { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_1_3', musculo: 'PECTORAL', nombre: 'Aperturas en Banco Inclinado', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_1_4', musculo: 'TRÍCEPS', nombre: 'Press Cerrado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 2 - Pull 1
  [
    { id: 'prem_ppl_2_1', musculo: 'ESPALDA', nombre: 'Peso Muerto Convencional', series: [ { repMin: '4', repMax: '6', extra: 'Ninguno' }, { repMin: '6', repMax: '8', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_2_2', musculo: 'DORSALES', nombre: 'Dominadas Supinas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_2_3', musculo: 'ESPALDA', nombre: 'Remo con Barra', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_2_4', musculo: 'BÍCEPS', nombre: 'Curl con Barra Z', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 3 - Legs 1
  [
    { id: 'prem_ppl_3_1', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla Baja Barra', series: [ { repMin: '4', repMax: '6', extra: 'Ninguno' }, { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '8', repMax: '10', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_3_2', musculo: 'ISQUIOS', nombre: 'Curl Femoral Acostado', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_3_3', musculo: 'CUÁDRICEPS', nombre: 'Hack Squat', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_3_4', musculo: 'GEMELOS', nombre: 'Gemelo Sentado', series: [ { repMin: '15', repMax: '20', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
  ],
  // Día 4 - Push 2 (volumen)
  [
    { id: 'prem_ppl_4_1', musculo: 'HOMBRO', nombre: 'Press con Mancuernas Sentado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_4_2', musculo: 'PECTORAL', nombre: 'Press Inclinado Máquina', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_4_3', musculo: 'HOMBRO', nombre: 'Elevaciones Laterales Cuerda', series: [ { repMin: '12', repMax: '20', extra: 'Ninguno' }, { repMin: '12', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_4_4', musculo: 'TRÍCEPS', nombre: 'Extensión Polea Alta Cuerda', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
  ],
  // Día 5 - Pull 2 (volumen)
  [
    { id: 'prem_ppl_5_1', musculo: 'DORSALES', nombre: 'Jalón Agarre Amplio', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_5_2', musculo: 'ESPALDA', nombre: 'Remo en Máquina Apoyado', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_5_3', musculo: 'TRAPECIO', nombre: 'Encogimientos con Barra', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_5_4', musculo: 'BÍCEPS', nombre: 'Curl Concentrado', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 6 - Legs 2 (volumen)
  [
    { id: 'prem_ppl_6_1', musculo: 'CUÁDRICEPS', nombre: 'Prensa 45°', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_6_2', musculo: 'GLÚTEOS', nombre: 'Hip Thrust Máquina', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_6_3', musculo: 'CUÁDRICEPS', nombre: 'Extensión de Rodilla', series: [ { repMin: '15', repMax: '20', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_ppl_6_4', musculo: 'ABDOMEN', nombre: 'Elevación de Piernas', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
  ],
];

// Rutina Premium 3: Powerbuilding 5 días
const POWERBUILDING_5_DATA = [
  // Día 1 - Fuerza Press Banca
  [
    { id: 'prem_pb_1_1', musculo: 'PECTORAL', nombre: 'Press Banca Competición', series: [ { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '5', repMax: '8', extra: 'Ninguno' } ] },
    { id: 'prem_pb_1_2', musculo: 'PECTORAL', nombre: 'Press Inclinado Mancuernas', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_pb_1_3', musculo: 'TRÍCEPS', nombre: 'JM Press', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_1_4', musculo: 'HOMBRO', nombre: 'Press Militar Sentado', series: [ { repMin: '8', repMax: '12', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 2 - Fuerza Sentadilla
  [
    { id: 'prem_pb_2_1', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla Competición', series: [ { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '5', repMax: '8', extra: 'Ninguno' } ] },
    { id: 'prem_pb_2_2', musculo: 'CUÁDRICEPS', nombre: 'Sentadilla Pausa', series: [ { repMin: '6', repMax: '8', extra: 'Ninguno' }, { repMin: '6', repMax: '8', extra: 'Ninguno' } ] },
    { id: 'prem_pb_2_3', musculo: 'CUÁDRICEPS', nombre: 'Prensa', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '10', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_2_4', musculo: 'ISQUIOS', nombre: 'Femoral Tumbado', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 3 - Fuerza Peso Muerto
  [
    { id: 'prem_pb_3_1', musculo: 'ESPALDA', nombre: 'Peso Muerto Convencional', series: [ { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '3', repMax: '5', extra: 'Ninguno' }, { repMin: '5', repMax: '8', extra: 'Ninguno' } ] },
    { id: 'prem_pb_3_2', musculo: 'ESPALDA', nombre: 'Remo Pendlay', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_pb_3_3', musculo: 'DORSALES', nombre: 'Dominadas Lastradas', series: [ { repMin: '6', repMax: '10', extra: 'Ninguno' }, { repMin: '8', repMax: '12', extra: 'Ninguno' } ] },
    { id: 'prem_pb_3_4', musculo: 'BÍCEPS', nombre: 'Curl con Barra', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
  ],
  // Día 4 - Hipertrofia Superior
  [
    { id: 'prem_pb_4_1', musculo: 'PECTORAL', nombre: 'Press Máquina Convergente', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_4_2', musculo: 'ESPALDA', nombre: 'Jalón Agarre Neutro', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_4_3', musculo: 'HOMBRO', nombre: 'Elevaciones Laterales', series: [ { repMin: '12', repMax: '20', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_pb_4_4', musculo: 'TRÍCEPS', nombre: 'Extensión Polea', series: [ { repMin: '15', repMax: '20', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
  ],
  // Día 5 - Hipertrofia Inferior
  [
    { id: 'prem_pb_5_1', musculo: 'CUÁDRICEPS', nombre: 'Hack Squat', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_5_2', musculo: 'GLÚTEOS', nombre: 'Hip Thrust', series: [ { repMin: '10', repMax: '15', extra: 'Ninguno' }, { repMin: '12', repMax: '15', extra: 'Ninguno' } ] },
    { id: 'prem_pb_5_3', musculo: 'ISQUIOS', nombre: 'Curl Femoral Sentado', series: [ { repMin: '12', repMax: '15', extra: 'Ninguno' }, { repMin: '15', repMax: '20', extra: 'Ninguno' } ] },
    { id: 'prem_pb_5_4', musculo: 'GEMELOS', nombre: 'Gemelo en Prensa', series: [ { repMin: '15', repMax: '25', extra: 'Ninguno' }, { repMin: '20', repMax: '25', extra: 'Ninguno' } ] },
  ],
];

// --- ARRAY PRINCIPAL DE RUTINAS PREMIUM ---
export const premiumRoutines = [
  {
    id: 'premium_torso_pierna_avanzada',
    nombre: 'Torso-Pierna Avanzada Pro',
    dias: 4,
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Torso/Pierna',
    enfoque: 'Hipertrofia Avanzada',
    nivel: 'Avanzado',
    diasArr: TORSO_PIERNA_AVANZADA_DATA
  },
  {
    id: 'premium_ppl_avanzado_6dias',
    nombre: 'PPL Avanzado 6 Días',
    dias: 6,
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Push/Pull/Legs',
    enfoque: 'Volumen Alto',
    nivel: 'Avanzado',
    diasArr: PPL_AVANZADO_DATA
  },
  {
    id: 'premium_powerbuilding_5dias',
    nombre: 'Powerbuilding Elite 5 Días',
    dias: 5,
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    division: 'Fuerza/Hipertrofia',
    enfoque: 'Powerlifting + Estética',
    nivel: 'Avanzado',
    diasArr: POWERBUILDING_5_DATA
  },
];

// Exportar IDs
export const TORSO_PIERNA_ID = premiumRoutines[0].id;
export const PPL_AVANZADO_ID = premiumRoutines[1].id;
export const POWERBUILDING_ID = premiumRoutines[2].id;