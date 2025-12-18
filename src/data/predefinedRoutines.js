// src/data/predefinedRoutines.js
// ⚠️ IMPORTANTE: Este archivo contiene SOLO rutinas GRATUITAS

// --- ARRAY PRINCIPAL DE RUTINAS PREDEFINIDAS (GRATUITAS) ---
export const predefinedRoutines = [
  // --- Rutina 1: Full-Body Principiantes (3 Días) ---
  {
    id: 'routine_generic_fullbody_001',
    nombre: "Rutina Full-Body Principiantes",
    dias: 3,
    diasArr: [
      // DÍA 1
      [
        {
          code: "cuad_sentadilla_libre",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Libre",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "isq_peso_muerto_rumano",
          musculo: "ISQUIOS",
          nombre: "Peso Muerto Rumano",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "dor_jalon_pecho",
          musculo: "DORSALES",
          nombre: "Jalon Pecho",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "esp_remo_en_t",
          musculo: "ESPALDA ALTA/MEDIA",
          nombre: "Remo T",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "pec_press_banca_maq",
          musculo: "PECTORAL",
          nombre: "Press Banca Maquina",
          series: [{ repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "del_lat_elev_lat_polea",
          musculo: "DELTOIDES LATERAL",
          nombre: "Elevaciones Laterales Polea",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 2
      [
        {
          code: "isq_sldl",
          musculo: "ISQUIOS",
          nombre: "SLDL",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "dor_dominadas",
          musculo: "DORSALES",
          nombre: "Dominadas",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "pec_press_poco_inc_maq",
          musculo: "PECTORAL",
          nombre: "Press Maquina Poco Inclinado",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "del_ant_press_militar_manc",
          musculo: "DELTOIDES ANTERIOR",
          nombre: "Press Militar Mancuernas",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "cuad_prensa",
          musculo: "CUÁDRICEPS",
          nombre: "Prensa",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "isq_femoral_tumbado",
          musculo: "ISQUIOS",
          nombre: "Femoral Tumbado",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 3
      [
        {
          code: "pec_press_banca",
          musculo: "PECTORAL",
          nombre: "Press Banca",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "del_ant_press_militar",
          musculo: "DELTOIDES ANTERIOR",
          nombre: "Press Militar",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "8", extra: "Ninguno" }]
        },
        {
          code: "cuad_sentadilla_bulgara_manc",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Bulgara Mancuernas",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "glu_hip_thrust",
          musculo: "GLÚTEO",
          nombre: "Hip Thrust",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "esp_remo_mp",
          musculo: "ESPALDA ALTA/MEDIA",
          nombre: "Remo Multipower",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "del_post_face_pulls",
          musculo: "DELTOIDES POSTERIOR",
          nombre: "Face Pulls",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ]
    ],
    division: "Full-Body",
    enfoque: "General",
    nivel: "Principiante",
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },

  // --- Rutina 2: 4 Días - Intermedia ---
  {
    id: 'RUTINA_GERMAN_MARTINEZ_4_DIAS',
    nombre: "Rutina 4 Días - Intermedia",
    dias: 4,
    diasArr: [
      // DÍA 1
      [
        {
          code: "del_lat_elev_lat_polea",
          musculo: "DELTOIDES LATERAL",
          nombre: "Elevaciones Laterales Polea",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "del_ant_press_militar_manc",
          musculo: "DELTOIDES ANTERIOR",
          nombre: "Press Militar Mancuernas",
          series: [{ repMin: "6", repMax: "10", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "pec_press_inc_manc",
          musculo: "PECTORAL",
          nombre: "Press Inclinado Mancuernas",
          series: [{ repMin: "6", repMax: "10", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "pec_press_banca",
          musculo: "PECTORAL",
          nombre: "Press Banca",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "tri_ext_codo_barra",
          musculo: "TRÍCEPS",
          nombre: "Extension Codo Barra",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "tri_press_frances_polea",
          musculo: "TRÍCEPS",
          nombre: "Press Frances Polea",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "cuad_ext_rodilla",
          musculo: "CUÁDRICEPS",
          nombre: "Extension Rodilla",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "abd_crunch_polea",
          musculo: "ABDOMEN",
          nombre: "Crunch Polea",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 2
      [
        {
          code: "gem_gemelo_prensa",
          musculo: "GEMELO",
          nombre: "Gemelo Prensa",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "isq_femoral_tumbado",
          musculo: "ISQUIOS",
          nombre: "Femoral Tumbado",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "dor_jalon_pecho",
          musculo: "DORSALES",
          nombre: "Jalon Pecho",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "esp_remo_en_t",
          musculo: "ESPALDA ALTA/MEDIA",
          nombre: "Remo T",
          series: [{ repMin: "6", repMax: "10", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "dor_jalon_pecho",
          musculo: "DORSALES",
          nombre: "Jalon Pecho",
          series: [{ repMin: "5", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "10", extra: "Ninguno" }]
        },
        {
          code: "del_post_maq",
          musculo: "DELTOIDES POSTERIOR",
          nombre: "Posterior Maquina",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "bic_curl_sentado_manc",
          musculo: "BÍCEPS",
          nombre: "Curl Sentado Mancuernas",
          series: [{ repMin: "5", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "10", extra: "Ninguno" }, { repMin: "6", repMax: "10", extra: "Ninguno" }]
        },
        {
          code: "bic_curl_barra",
          musculo: "BÍCEPS",
          nombre: "Curl Barra",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        }
      ],
      // DÍA 3
      [
        {
          code: "isq_peso_muerto_rumano",
          musculo: "ISQUIOS",
          nombre: "Peso Muerto Rumano",
          series: [{ repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "cuad_sentadilla_libre",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Libre",
          series: [{ repMin: "4", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "10", extra: "Ninguno" }]
        },
        {
          code: "cuad_prensa",
          musculo: "CUÁDRICEPS",
          nombre: "Prensa",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "isq_femoral_sentado",
          musculo: "ISQUIOS",
          nombre: "Femoral Sentado",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "cuad_ext_rodilla",
          musculo: "CUÁDRICEPS",
          nombre: "Extension Rodilla",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "adu_aductor_maq",
          musculo: "ADUCTORES",
          nombre: "Aductor Maquina",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "abd_encogimientos_maq",
          musculo: "ABDOMEN",
          nombre: "Encogimientos Maquina",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 4
      [
        {
          code: "del_lat_elev_lat_manc",
          musculo: "DELTOIDES LATERAL",
          nombre: "Elevacion Lateral Mancuerna",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "pec_press_inc_manc",
          musculo: "PECTORAL",
          nombre: "Press Inclinado Mancuernas",
          series: [{ repMin: "5", repMax: "8", extra: "Ninguno" }, { repMin: "5", repMax: "8", extra: "Ninguno" }, { repMin: "6", repMax: "10", extra: "Ninguno" }]
        },
        {
          code: "esp_remo_en_t",
          musculo: "ESPALDA ALTA/MEDIA",
          nombre: "Remo T",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "esp_remo_t_de_pie",
          musculo: "ESPALDA ALTA/MEDIA",
          nombre: "Remo T Pie",
          series: [{ repMin: "6", repMax: "10", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "del_post_polea_unilat",
          musculo: "DELTOIDES POSTERIOR",
          nombre: "Posterior Polea Unilateral",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "tri_ext_codo_cuerda",
          musculo: "TRÍCEPS",
          nombre: "Extension Codo Cuerda",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "bic_curl_barra",
          musculo: "BÍCEPS",
          nombre: "Curl Barra",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "15", extra: "Ninguno" }]
        }
      ]
    ],
    division: "Push/Pull/Legs/Push-Pull",
    enfoque: "Hipertrofia",
    nivel: "Intermedio",
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },

  // --- Rutina 3: Principiante Casa con Gomas (3 Días) ---
  {
    id: 'routine_casa_gomas_001',
    nombre: "3D-Principiante Casa Gomas",
    dias: 3,
    diasArr: [
      // DÍA 1
      [
        {
          code: "cuad_sentadilla_goma",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Goma",
          series: [{ repMin: "6", repMax: "8", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "cuad_zancada_estatica",
          musculo: "CUÁDRICEPS",
          nombre: "Zancada Estática",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "isq_femoral_tumbado_goma",
          musculo: "ISQUIOS",
          nombre: "Femoral Tumbado Goma",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "dor_dominadas_asistidas_goma",
          musculo: "DORSALES",
          nombre: "Dominadas Asistidas Goma",
          series: [{ repMin: "1", repMax: "Fallo", extra: "Ninguno" }, { repMin: "1", repMax: "Fallo", extra: "Ninguno" }, { repMin: "1", repMax: "Fallo", extra: "Ninguno" }]
        },
        {
          code: "pec_flexiones_clasicas",
          musculo: "PECTORAL",
          nombre: "Flexiones Clásicas",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "del_lat_elevaciones_laterales_goma",
          musculo: "DELTOIDES LATERAL",
          nombre: "Elevaciones Laterales Goma",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 2
      [
        {
          code: "isq_peso_muerto_rumano_goma",
          musculo: "ISQUIOS",
          nombre: "Peso Muerto Rumano Goma",
          series: [{ repMin: "8", repMax: "10", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "cuad_zancada_hacia_atras",
          musculo: "CUÁDRICEPS",
          nombre: "Zancada Hacia Atrás",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "glu_puente_gluteo",
          musculo: "GLÚTEO",
          nombre: "Puente de Glúteo Goma",
          series: [{ repMin: "15", repMax: "20", extra: "Ninguno" }, { repMin: "15", repMax: "20", extra: "Ninguno" }]
        },
        {
          code: "dor_remo_pie_goma",
          musculo: "DORSALES",
          nombre: "Remo Pie Goma",
          series: [{ repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }, { repMin: "10", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "del_ant_press_militar_goma",
          musculo: "DELTOIDES ANTERIOR",
          nombre: "Press Militar Goma",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "bic_curl_biceps_goma",
          musculo: "BÍCEPS",
          nombre: "Curl Bíceps Goma",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ],
      // DÍA 3
      [
        {
          code: "cuad_sentadilla_goblet_goma",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Goblet Goma",
          series: [{ repMin: "8", repMax: "10", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "cuad_sentadilla_bulgara",
          musculo: "CUÁDRICEPS",
          nombre: "Sentadilla Búlgara",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "gem_elevacion_talones_pie",
          musculo: "GEMELO",
          nombre: "Elevación Talones Pie",
          series: [{ repMin: "15", repMax: "20", extra: "Ninguno" }, { repMin: "15", repMax: "20", extra: "Ninguno" }]
        },
        {
          code: "del_post_face_pull_goma",
          musculo: "DELTOIDES POSTERIOR",
          nombre: "Face Pull Goma",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        },
        {
          code: "tri_fondos_silla",
          musculo: "TRÍCEPS",
          nombre: "Fondos Silla",
          series: [{ repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }, { repMin: "8", repMax: "12", extra: "Ninguno" }]
        },
        {
          code: "tri_extensiones_sobre_cabeza",
          musculo: "TRÍCEPS",
          nombre: "Extensiones Tríceps Sobre Cabeza",
          series: [{ repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }, { repMin: "12", repMax: "15", extra: "Ninguno" }]
        }
      ]
    ],
    division: "Full-Body",
    enfoque: "General",
    nivel: "Principiante",
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
];

// Exportar IDs si los usas en otro lugar
export const GENERIC_ID = predefinedRoutines[0].id;
export const GERMAN_MARTINEZ_ID = predefinedRoutines[1].id;
export const CASA_GOMAS_ID = predefinedRoutines[2].id;

// Mantener compatibilidad con código que use GENERIC_FULLBODY_DATA
export const GENERIC_FULLBODY_DATA = predefinedRoutines[0].diasArr;