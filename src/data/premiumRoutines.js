// src/data/premiumRoutines.js
// ⚠️ IMPORTANTE: Este archivo contiene SOLO rutinas PREMIUM

export const premiumRoutines = [
  {
    id: 'premium_8d_avanz_4d4d',
    nombre: "RUT 8D AVANZ 4D+4D",
    dias: 10,
    diasArr: [
      // DÍA 1 - Pierna Cuádriceps/Isquios
      [
        {
          code: "cuad_hack_squat", musculo: "CUÁDRICEPS", nombre: "Hack Squat", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        },
        {
          code: "isq_buenos_dias_mp", musculo: "ISQUIOS", nombre: "Buenos Dias Multipower", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "isq_rumano_mancuernas", musculo: "ISQUIOS", nombre: "Rumano Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_prensa", musculo: "CUÁDRICEPS", nombre: "Prensa", series: [
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "adu_aductor_maq", musculo: "ADUCTORES", nombre: "Aductor Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "isq_femoral_sentado", musculo: "ISQUIOS", nombre: "Femoral Sentado", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_ext_rodilla", musculo: "CUÁDRICEPS", nombre: "Extension Rodilla", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        }
      ],
      // DÍA 2 - Espalda + Posterior + Bíceps
      [
        {
          code: "dor_jalon_pecho", musculo: "DORSALES", nombre: "Jalon Pecho", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "esp_remo_gironda", musculo: "ESPALDA ALTA/MEDIA", nombre: "Remo Gironda", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "dor_jalon_maq_bilat", musculo: "DORSALES", nombre: "Jalon Maquina Bilateral", series: [
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "dor_pullover_unilat_estiramiento", musculo: "DORSALES", nombre: "Pull Over Unilateral Estiramiento", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_face_pulls", musculo: "DELTOIDES POSTERIOR", nombre: "Face Pulls", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_maq", musculo: "DELTOIDES POSTERIOR", nombre: "Posterior Maquina", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_polea_bilat", musculo: "DELTOIDES POSTERIOR", nombre: "Posterior Polea Bilateral", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_barra", musculo: "BÍCEPS", nombre: "Curl Barra", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 3 - Pecho + Hombros
      [
        {
          code: "pec_press_inc_manc", musculo: "PECTORAL", nombre: "Press Inclinado Mancuernas", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_press_plano_maq", musculo: "PECTORAL", nombre: "Press Plano Maquina", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_aperturas_pec_deck", musculo: "PECTORAL", nombre: "Aperturas Pec Deck", series: [
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_cruce_poleas", musculo: "PECTORAL", nombre: "Cruce Poleas", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_press_militar_manc", musculo: "DELTOIDES ANTERIOR", nombre: "Press Militar Mancuernas", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_elev_frontal_cuerda", musculo: "DELTOIDES ANTERIOR", nombre: "Elevacion Frontal Cuerda", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Rest-Pause" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Rest-Pause" }
          ]
        },
        {
          code: "del_lat_elev_lat_manc", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Mancuerna", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_polea", musculo: "DELTOIDES LATERAL", nombre: "Elevaciones Laterales Polea", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_maq", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 4 - Gemelos + Abdomen + Brazos
      [
        {
          code: "gem_elev_talon_maq", musculo: "GEMELO", nombre: "Elevacion Talon Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "abd_crunch_polea", musculo: "ABDOMEN", nombre: "Crunch Polea", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "gem_elev_talon_sentado", musculo: "GEMELO", nombre: "Elevacion Talon Sentado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "abd_elev_piernas_colgado", musculo: "ABDOMEN", nombre: "Elevacion Piernas Colgado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_sentado_manc", musculo: "BÍCEPS", nombre: "Curl Sentado Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_martillo_sentado", musculo: "BÍCEPS", nombre: "Martillo Sentado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_scott_barra", musculo: "BÍCEPS", nombre: "Curl Scott Barra", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_tras_nuca", musculo: "TRÍCEPS", nombre: "Extension Codo Tras Nuca", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_unilat", musculo: "TRÍCEPS", nombre: "Extension Codo Unilateral", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_fondos_maq", musculo: "TRÍCEPS", nombre: "Fondos Maquina Triceps", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 6 - Isquios + Glúteo + Cuádriceps
      [
        {
          code: "isq_femoral_tumbado", musculo: "ISQUIOS", nombre: "Femoral Tumbado", series: [
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "isq_peso_muerto_rumano", musculo: "ISQUIOS", nombre: "Peso Muerto Rumano", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "glu_hip_thrust", musculo: "GLÚTEO", nombre: "Hip Thrust", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "adu_aductor_maq", musculo: "ADUCTORES", nombre: "Aductor Maquina", series: [
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_ext_rodilla", musculo: "CUÁDRICEPS", nombre: "Extension Rodilla", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        },
        {
          code: "isq_femoral_sentado", musculo: "ISQUIOS", nombre: "Femoral Sentado", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 7 - Espalda + Posterior + Bíceps
      [
        {
          code: "dor_remo_gironda_unilat", musculo: "DORSALES", nombre: "Remo Gironda Unilateral", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "esp_remo_hammer_bilat", musculo: "ESPALDA ALTA/MEDIA", nombre: "Remo Hammer Bilateral", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "dor_jalon_maq_bilat", musculo: "DORSALES", nombre: "Jalon Maquina Bilateral", series: [
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" },
            { repMin: "12", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "esp_seal_row_barra", musculo: "ESPALDA ALTA/MEDIA", nombre: "Seal Row Barra", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_face_pulls", musculo: "DELTOIDES POSTERIOR", nombre: "Face Pulls", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_maq", musculo: "DELTOIDES POSTERIOR", nombre: "Posterior Maquina", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_polea_bilat", musculo: "DELTOIDES POSTERIOR", nombre: "Posterior Polea Bilateral", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_barra", musculo: "BÍCEPS", nombre: "Curl Barra", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 8 - Hombros + Pecho
      [
        {
          code: "del_lat_elev_lat_manc", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Mancuerna", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_polea", musculo: "DELTOIDES LATERAL", nombre: "Elevaciones Laterales Polea", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_maq", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_remo_menton", musculo: "DELTOIDES LATERAL", nombre: "Remo Menton", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_press_militar_mp", musculo: "DELTOIDES ANTERIOR", nombre: "Press Militar Multipower", series: [
            { repMin: "6", repMax: "8", extra: "Ninguno" },
            { repMin: "8", repMax: "10", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_elev_frontal_cuerda", musculo: "DELTOIDES ANTERIOR", nombre: "Elevacion Frontal Cuerda", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Rest-Pause" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Rest-Pause" }
          ]
        },
        {
          code: "pec_fondos_libres", musculo: "PECTORAL", nombre: "Fondos Libres", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 9 - Gemelos + Abdomen + Brazos
      [
        {
          code: "gem_elev_talon_maq", musculo: "GEMELO", nombre: "Elevacion Talon Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "abd_crunch_polea", musculo: "ABDOMEN", nombre: "Crunch Polea", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "gem_elev_talon_sentado", musculo: "GEMELO", nombre: "Elevacion Talon Sentado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "abd_elev_piernas_colgado", musculo: "ABDOMEN", nombre: "Elevacion Piernas Colgado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_tras_nuca", musculo: "TRÍCEPS", nombre: "Extension Codo Tras Nuca", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_unilat", musculo: "TRÍCEPS", nombre: "Extension Codo Unilateral", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_fondos_maq", musculo: "TRÍCEPS", nombre: "Fondos Maquina Triceps", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_sentado_manc", musculo: "BÍCEPS", nombre: "Curl Sentado Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Biserie" },
            { repMin: "12", repMax: "15", extra: "Biserie" },
            { repMin: "15", repMax: "20", extra: "Biserie" }
          ]
        },
        {
          code: "bic_martillo_sentado", musculo: "BÍCEPS", nombre: "Martillo Sentado", series: [
            { repMin: "12", repMax: "15", extra: "Biserie" },
            { repMin: "12", repMax: "15", extra: "Biserie" },
            { repMin: "15", repMax: "20", extra: "Biserie" }
          ]
        },
        {
          code: "bic_curl_scott_barra", musculo: "BÍCEPS", nombre: "Curl Scott Barra", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        }
      ],
    ],
    division: "4D+4D (8 días)",
    enfoque: "Hipertrofia Avanzada",
    nivel: "Avanzado",
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },

  // ═══════════════ RUTINA 6D WEIDER DIFICIL ═══════════════
  {
    id: 'premium_6d_weider_dificil',
    nombre: "RUTINA 6D - WEIDER-DIFICIL",
    dias: 6,
    diasArr: [
      // DÍA 1 - Pierna
      [
        {
          code: "cuad_hack_squat", musculo: "CUÁDRICEPS", nombre: "Hack Squat", series: [
            { repMin: "6", repMax: "10", extra: "Ninguno" },
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "isq_peso_muerto_rumano", musculo: "ISQUIOS", nombre: "Peso Muerto Rumano", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_prensa", musculo: "CUÁDRICEPS", nombre: "Prensa", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "adu_aductor_maq", musculo: "ADUCTORES", nombre: "Aductor Maquina", series: [
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" }
          ]
        },
        {
          code: "isq_femoral_sentado", musculo: "ISQUIOS", nombre: "Femoral Sentado", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_ext_rodilla", musculo: "CUÁDRICEPS", nombre: "Extension Rodilla", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        }
      ],
      // DÍA 2 - Pecho + Hombro
      [
        {
          code: "pec_press_inc_manc", musculo: "PECTORAL", nombre: "Press Inclinado Mancuernas", series: [
            { repMin: "6", repMax: "10", extra: "Ninguno" },
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_press_plano_maq", musculo: "PECTORAL", nombre: "Press Plano Maquina", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_fondos_libres", musculo: "PECTORAL", nombre: "Fondos Libres", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_aperturas_pec_deck", musculo: "PECTORAL", nombre: "Aperturas Pec Deck", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_press_militar_manc", musculo: "DELTOIDES ANTERIOR", nombre: "Press Militar Mancuernas", series: [
            { repMin: "8", repMax: "10", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_manc", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Mancuerna", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 3 - Espalda + Posterior
      [
        {
          code: "dor_remo_gironda_unilat", musculo: "DORSALES", nombre: "Remo Gironda Unilateral", series: [
            { repMin: "6", repMax: "10", extra: "Ninguno" },
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "dor_jalon_pecho", musculo: "DORSALES", nombre: "Jalon Pecho", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "esp_remo_sentado_agarre_abierto", musculo: "ESPALDA ALTA/MEDIA", nombre: "Remo Sentado Agarre Abierto", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "dor_pullover_cuerda", musculo: "DORSALES", nombre: "Pull Over Cuerda", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_face_pulls", musculo: "DELTOIDES POSTERIOR", nombre: "Face Pulls", series: [
            { repMin: "8", repMax: "10", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_post_maq", musculo: "DELTOIDES POSTERIOR", nombre: "Posterior Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 4 - Hombro + Gemelo + Abs + Brazos
      [
        {
          code: "del_lat_elev_lat_manc", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Mancuerna", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_polea", musculo: "DELTOIDES LATERAL", nombre: "Elevaciones Laterales Polea", series: [
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "gem_elev_talon_maq", musculo: "GEMELO", nombre: "Elevacion Talon Maquina", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "abd_crunch_polea", musculo: "ABDOMEN", nombre: "Crunch Polea", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_curl_sentado_manc", musculo: "BÍCEPS", nombre: "Curl Sentado Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "bic_martillo_sentado", musculo: "BÍCEPS", nombre: "Martillo Sentado", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_tras_nuca", musculo: "TRÍCEPS", nombre: "Extension Codo Tras Nuca", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "tri_ext_codo_cuerda", musculo: "TRÍCEPS", nombre: "Extension Codo Cuerda", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 5 - Pierna 2
      [
        {
          code: "isq_peso_muerto_rumano", musculo: "ISQUIOS", nombre: "Peso Muerto Rumano", series: [
            { repMin: "6", repMax: "10", extra: "Ninguno" },
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_sentadilla_bulgara_manc", musculo: "CUÁDRICEPS", nombre: "Sentadilla Bulgara Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_prensa", musculo: "CUÁDRICEPS", nombre: "Prensa", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        },
        {
          code: "adu_aductor_maq", musculo: "ADUCTORES", nombre: "Aductor Maquina", series: [
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "12", extra: "Ninguno" }
          ]
        },
        {
          code: "cuad_ext_rodilla", musculo: "CUÁDRICEPS", nombre: "Extension Rodilla", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Descendentes" }
          ]
        },
        {
          code: "isq_femoral_sentado", musculo: "ISQUIOS", nombre: "Femoral Sentado", series: [
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "10", repMax: "15", extra: "Ninguno" },
            { repMin: "Fallo", repMax: "Fallo", extra: "Ninguno" }
          ]
        }
      ],
      // DÍA 6 - Torso Ligero
      [
        {
          code: "dor_jalon_pecho", musculo: "DORSALES", nombre: "Jalon Pecho", series: [
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "esp_remo_gironda", musculo: "ESPALDA ALTA/MEDIA", nombre: "Remo Gironda", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_press_plano_maq", musculo: "PECTORAL", nombre: "Press Plano Maquina", series: [
            { repMin: "8", repMax: "12", extra: "Ninguno" },
            { repMin: "10", repMax: "12", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "pec_press_inc_manc", musculo: "PECTORAL", nombre: "Press Inclinado Mancuernas", series: [
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "12", repMax: "15", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_ant_press_militar_maq", musculo: "DELTOIDES ANTERIOR", nombre: "Press Militar Maquina", series: [
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        },
        {
          code: "del_lat_elev_lat_maq", musculo: "DELTOIDES LATERAL", nombre: "Elevacion Lateral Maquina", series: [
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" },
            { repMin: "15", repMax: "20", extra: "Ninguno" }
          ]
        }
      ]
    ],
    division: "6 Días Weider",
    enfoque: "Hipertrofia",
    nivel: "Avanzado",
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
];

// Exportar IDs
export const RUT_8D_AVANZ_4D4D_ID = premiumRoutines[0].id;
export const RUT_6D_WEIDER_DIFICIL_ID = premiumRoutines[1].id;